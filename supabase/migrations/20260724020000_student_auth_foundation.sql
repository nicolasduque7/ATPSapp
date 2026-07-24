-- Phase 0 of student accounts: a role concept, a coach-invite -> student-
-- signup -> auto-link flow, and closing a real security hole this creates.
--
-- Today every Supabase Auth user is unconditionally treated as a coach:
-- there is no `role` anywhere, and `locations`/`students` RLS is
-- `using (true)` for any `authenticated` user while `classes`/`class_series`
-- only check `coach_id = auth.uid()` — which any freshly-signed-up user's
-- own uid trivially satisfies on insert. The moment student logins exist,
-- that's a full coach-level write hole. This migration closes it.

-- ── role model ──────────────────────────────────────────────────────────────
create type app_role as enum ('coach', 'student');

create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role app_role not null,
  created_at timestamptz not null default now()
);
alter table profiles enable row level security;

create policy "profiles_select_own" on profiles
  for select to authenticated using (id = auth.uid());
-- Deliberately no insert/update/delete policy for `authenticated` at all —
-- the only writer is the SECURITY DEFINER trigger below. A client can never
-- set or change its own role, regardless of what it sends to PostgREST.

-- Backfill: every existing coach predates this table. Must run in this same
-- migration or every current coach gets locked out the moment requireCoach()
-- starts checking profiles.role.
insert into profiles (id, role)
select id, 'coach' from auth.users
on conflict (id) do nothing;

-- SECURITY DEFINER + hardcoded existence check keyed only on auth.uid() —
-- can't be misused to read arbitrary rows, and avoids RLS-policy recursion
-- (an invoker-rights version used inside profiles' own RLS would recurse).
create or replace function is_coach() returns boolean
  language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles where id = auth.uid() and role = 'coach');
$$;
create or replace function is_student() returns boolean
  language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles where id = auth.uid() and role = 'student');
$$;
revoke execute on function is_coach() from public, anon;
revoke execute on function is_student() from public, anon;
grant execute on function is_coach() to authenticated;
grant execute on function is_student() to authenticated;

-- ── student auth linkage + invites ──────────────────────────────────────────
alter table students
  add column email text,
  add column auth_user_id uuid unique references auth.users(id) on delete set null;
-- on delete set null (not cascade/restrict): if the linked login is ever
-- deleted, the roster/coaching-history row survives, just reverts to
-- "unlinked" — unlike classes/series, a student row has independent meaning
-- with or without a linked account.
create unique index students_email_key on students (email) where email is not null;

create table student_invites (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references students(id) on delete cascade,
  email text not null,
  token text not null default encode(extensions.gen_random_bytes(32), 'hex'),
  invited_by uuid references auth.users(id) on delete set null,
  expires_at timestamptz not null default (now() + interval '7 days'),
  redeemed_at timestamptz,
  redeemed_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create unique index student_invites_token_idx on student_invites (token);
create index student_invites_student_id_idx on student_invites (student_id);
alter table student_invites enable row level security;

create policy "student_invites_select_coach" on student_invites
  for select to authenticated using (is_coach());
create policy "student_invites_insert_coach" on student_invites
  for insert to authenticated with check (is_coach() and invited_by = auth.uid());
create policy "student_invites_delete_coach" on student_invites
  for delete to authenticated using (is_coach());
-- No update policy for `authenticated` — redemption only happens inside the
-- SECURITY DEFINER trigger below, never via a client-issued UPDATE.

-- Redemption runs as a trigger on auth.users, not a client-called RPC.
-- supabase.auth.signUp() is a public GoTrue endpoint RLS cannot gate at all;
-- if redemption were a second RPC called after signup succeeds, there'd be a
-- real window (dropped request, buggy client, someone hitting signUp()
-- directly) where an account exists with no role resolved. Doing it in the
-- same transaction as the auth.users insert eliminates that window: if this
-- raises, the whole signup rolls back and signUp() itself fails with the
-- message below.
create or replace function handle_new_user() returns trigger
  language plpgsql security definer set search_path = public as $$
declare
  v_token text;
  v_invite student_invites%rowtype;
begin
  v_token := new.raw_user_meta_data ->> 'invite_token';

  if v_token is null then
    insert into profiles (id, role) values (new.id, 'coach'); -- today's behavior, unchanged
    return new;
  end if;

  select * into v_invite from student_invites where token = v_token for update;
  if not found then
    raise exception 'This invite link is invalid.';
  end if;
  if v_invite.redeemed_at is not null then
    raise exception 'This invite has already been used.';
  end if;
  if v_invite.expires_at < now() then
    raise exception 'This invite has expired. Ask your coach to resend it.';
  end if;
  if lower(v_invite.email) is distinct from lower(new.email) then
    raise exception 'This invite was issued to a different email address.';
  end if;

  update students
     set auth_user_id = new.id, email = coalesce(email, new.email)
   where id = v_invite.student_id and auth_user_id is null;
  if not found then
    raise exception 'This student is already linked to another account.';
  end if;

  update student_invites set redeemed_at = now(), redeemed_by = new.id where id = v_invite.id;
  insert into profiles (id, role) values (new.id, 'student');
  return new;
end;
$$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function handle_new_user();
revoke execute on function handle_new_user() from public, anon, authenticated;

-- Pre-signup preview (visitor has no session yet) so the invite page can
-- show "invalid" / "expired" / "already used" / the right names before any
-- password form appears.
create or replace function get_invite_preview(p_token text)
  returns table (valid boolean, reason text, student_name text, coach_name text, email text)
  language sql stable security definer set search_path = public as $$
  select
    (i.redeemed_at is null and i.expires_at > now()),
    case when i.id is null then 'not_found'
         when i.redeemed_at is not null then 'redeemed'
         when i.expires_at <= now() then 'expired'
         else 'ok' end,
    s.name, coalesce(u.raw_user_meta_data ->> 'full_name', u.email), i.email
  from student_invites i
  join students s on s.id = i.student_id
  join auth.users u on u.id = i.invited_by
  where i.token = p_token;
$$;
revoke execute on function get_invite_preview(text) from public;
grant execute on function get_invite_preview(text) to anon, authenticated;

-- ── RLS hardening: locations & students ─────────────────────────────────────
-- Same "shared club-wide" shape, just gated on is_coach() instead of
-- using(true) — zero behavior change for real coaches (all backfilled into
-- profiles above), closes the "any authenticated user can write" hole.
drop policy "locations_select_shared" on locations;
drop policy "locations_insert_shared" on locations;
drop policy "locations_update_shared" on locations;
drop policy "locations_delete_shared" on locations;
create policy "locations_select_coach" on locations for select to authenticated using (is_coach());
create policy "locations_insert_coach" on locations for insert to authenticated with check (is_coach());
create policy "locations_update_coach" on locations for update to authenticated using (is_coach()) with check (is_coach());
create policy "locations_delete_coach" on locations for delete to authenticated using (is_coach());

drop policy "students_select_shared" on students;
drop policy "students_insert_shared" on students;
drop policy "students_update_shared" on students;
drop policy "students_delete_shared" on students;
create policy "students_select_coach" on students for select to authenticated using (is_coach());
create policy "students_insert_coach" on students for insert to authenticated with check (is_coach());
create policy "students_update_coach" on students for update to authenticated using (is_coach()) with check (is_coach());
create policy "students_delete_coach" on students for delete to authenticated using (is_coach());
-- A linked student may read their own single row (no insert/update/delete —
-- students can't edit their own record in Phase 0).
create policy "students_select_own_linked" on students
  for select to authenticated using (auth_user_id = auth.uid());

-- ── RLS hardening: classes & class_series ───────────────────────────────────
-- coach_id = auth.uid() alone is exactly the hole: a student's own uid
-- trivially satisfies it on insert, letting them fabricate class rows for
-- themselves. Add is_coach() to all four operations on both tables.
drop policy "classes_select_own" on classes;
drop policy "classes_insert_own" on classes;
drop policy "classes_update_own" on classes;
drop policy "classes_delete_own" on classes;
create policy "classes_select_own" on classes for select using (is_coach() and coach_id = auth.uid());
create policy "classes_insert_own" on classes for insert with check (is_coach() and coach_id = auth.uid());
create policy "classes_update_own" on classes for update using (is_coach() and coach_id = auth.uid()) with check (is_coach() and coach_id = auth.uid());
create policy "classes_delete_own" on classes for delete using (is_coach() and coach_id = auth.uid());

drop policy "class_series_select_own" on class_series;
drop policy "class_series_insert_own" on class_series;
drop policy "class_series_update_own" on class_series;
drop policy "class_series_delete_own" on class_series;
create policy "class_series_select_own" on class_series for select using (is_coach() and coach_id = auth.uid());
create policy "class_series_insert_own" on class_series for insert with check (is_coach() and coach_id = auth.uid());
create policy "class_series_update_own" on class_series for update using (is_coach() and coach_id = auth.uid()) with check (is_coach() and coach_id = auth.uid());
create policy "class_series_delete_own" on class_series for delete using (is_coach() and coach_id = auth.uid());

-- Minimal student read on classes only (not class_series — students need
-- instances, not recurrence rules). Keyed on student_id, not coach_id, so it
-- already spans every coach without modification — doesn't foreclose the
-- future "students see every coach's calendar" phase, just isn't exposed in
-- any UI yet.
create policy "classes_select_own_as_student" on classes
  for select to authenticated using (
    is_student() and exists (
      select 1 from students s where s.id = classes.student_id and s.auth_user_id = auth.uid()
    )
  );
-- classes_with_status (the security_invoker view) needs no changes — it
-- transparently inherits this new policy.

-- Optional low-cost hardening: a linked student could otherwise call this
-- directly to learn an unrelated student's booking details/coach name.
-- Every current caller is already a coach, so this is a no-op for them.
create or replace function check_student_conflict(
  p_student_id uuid,
  p_start_time timestamp,
  p_end_time timestamp,
  p_exclude_class_id uuid default null
)
returns table (coach_name text, start_time timestamp, end_time timestamp)
language sql security definer set search_path = public as $$
  select
    coalesce(u.raw_user_meta_data ->> 'full_name', u.email) as coach_name,
    c.start_time,
    c.end_time
  from classes c
  join auth.users u on u.id = c.coach_id
  where is_coach()
    and c.student_id = p_student_id
    and tsrange(c.start_time, c.end_time) && tsrange(p_start_time, p_end_time)
    and (p_exclude_class_id is null or c.id != p_exclude_class_id)
  limit 1;
$$;
