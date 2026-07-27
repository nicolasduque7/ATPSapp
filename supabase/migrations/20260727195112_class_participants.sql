-- Approved joiners of an Open Class. Deliberately a separate table, not a
-- second row shape on `classes`: `classes.student_id` keeps meaning exactly
-- what it always has (the one host), so classes_no_student_overlap and
-- classes_no_coach_overlap (the two existing GiST double-booking guarantees)
-- need zero changes. This table gets its own, symmetric guarantee: a
-- student can't join two overlapping Open Classes.
--
-- start_time/end_time are a denormalized copy of the parent class's, kept in
-- sync by the trigger below — a GiST exclusion constraint needs its range
-- columns on the same table, so there's no way to express "no overlap"
-- against classes.start_time/end_time without either this copy or a
-- materialized view (overkill for v1).
--
-- Known accepted gap: a joiner double-booking against a class they
-- personally HOST elsewhere is not caught here (that's a different table
-- entirely) — only by decide_join_request's app-level re-check at approval
-- time, not a hard DB guarantee. A true cross-table constraint would need a
-- materialized view/trigger scheme; not worth it for v1.
create table class_participants (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references classes(id) on delete cascade,
  student_id uuid not null references students(id) on delete restrict,
  start_time timestamp not null,
  end_time timestamp not null,
  joined_at timestamptz not null default now(),
  unique (class_id, student_id)
);

create index class_participants_class_id_idx on class_participants (class_id);
create index class_participants_student_id_idx on class_participants (student_id);

alter table class_participants add constraint class_participants_no_student_overlap
  exclude using gist (student_id with =, tsrange(start_time, end_time) with &&);

alter table class_participants enable row level security;

-- Read-only for clients. The host of the class, any approved joiner of it,
-- and the hosting coach can all see the roster; nobody else. No
-- insert/update/delete policy for `authenticated` at all — the only writer
-- is decide_join_request (see the notifications migration), so a client can
-- never add itself as a participant without going through the request flow.
create policy "class_participants_select_host" on class_participants
  for select to authenticated using (
    exists (
      select 1 from classes c
      join students s on s.id = c.student_id
      where c.id = class_participants.class_id and s.auth_user_id = auth.uid()
    )
  );
create policy "class_participants_select_own" on class_participants
  for select to authenticated using (
    exists (select 1 from students s where s.id = class_participants.student_id and s.auth_user_id = auth.uid())
  );
create policy "class_participants_select_coach" on class_participants
  for select to authenticated using (
    is_coach() and exists (
      select 1 from classes c where c.id = class_participants.class_id and c.coach_id = auth.uid()
    )
  );

-- Keeps the denormalized start_time/end_time from going stale if a host
-- reschedules a class that already has joiners. Must be SECURITY DEFINER:
-- class_participants has no client UPDATE policy at all, so an
-- invoker-rights trigger would silently update zero rows under RLS.
create or replace function sync_class_participants_time() returns trigger
  language plpgsql security definer set search_path = public as $$
begin
  update class_participants
     set start_time = new.start_time, end_time = new.end_time
   where class_id = new.id
     and (start_time, end_time) is distinct from (new.start_time, new.end_time);
  return new;
end;
$$;
create trigger classes_sync_participants_time
  after update of start_time, end_time on classes
  for each row execute function sync_class_participants_time();

-- Extend the existing friendly pre-check so a student's joined-Open-Class
-- commitments also surface as a conflict, not just classes they host.
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
  where (
      is_coach()
      or (is_student() and p_student_id = (select id from students where auth_user_id = auth.uid()))
    )
    and c.student_id = p_student_id
    and tsrange(c.start_time, c.end_time) && tsrange(p_start_time, p_end_time)
    and (p_exclude_class_id is null or c.id != p_exclude_class_id)
  union all
  select
    coalesce(u.raw_user_meta_data ->> 'full_name', u.email) as coach_name,
    cp.start_time,
    cp.end_time
  from class_participants cp
  join classes c on c.id = cp.class_id
  join auth.users u on u.id = c.coach_id
  where (
      is_coach()
      or (is_student() and p_student_id = (select id from students where auth_user_id = auth.uid()))
    )
    and cp.student_id = p_student_id
    and tsrange(cp.start_time, cp.end_time) && tsrange(p_start_time, p_end_time)
    and (p_exclude_class_id is null or cp.class_id != p_exclude_class_id)
  limit 1;
$$;
