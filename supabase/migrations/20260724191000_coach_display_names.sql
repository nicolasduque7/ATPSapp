-- Coach display names: needed so the Calendar's cross-coach toggles and the
-- new coach-availability feature can label events/blocks with "whose" they
-- are. Today a coach's name only ever comes from auth.users.raw_user_meta_data,
-- which a client can only read for *itself* (supabase.auth.getUser()) — there
-- was no way to read another coach's name at all.

alter table profiles add column display_name text;

update profiles p
set display_name = coalesce(u.raw_user_meta_data ->> 'full_name', u.email)
from auth.users u
where u.id = p.id;

create or replace function handle_new_user() returns trigger
  language plpgsql security definer set search_path = public as $$
declare
  v_token text;
  v_invite student_invites%rowtype;
begin
  v_token := new.raw_user_meta_data ->> 'invite_token';

  if v_token is null then
    insert into profiles (id, role, display_name)
    values (new.id, 'coach', coalesce(new.raw_user_meta_data ->> 'full_name', new.email));
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
  insert into profiles (id, role, display_name) values (new.id, 'student', new.raw_user_meta_data ->> 'full_name');
  return new;
end;
$$;

-- Any coach can read the roster of other coaches' names (needed to label
-- calendar events/availability blocks); students aren't granted this yet —
-- out of scope until the student-facing calendar is built.
create policy "profiles_select_coach_directory" on profiles
  for select to authenticated using (is_coach() and role = 'coach');
