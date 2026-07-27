-- A student's request to join someone else's Open Class. Routed to the
-- class's own coach only for v1 (not the host student) — matches the
-- product decision that the host student only learns about a request once
-- it's been decided, via the notifications table (next migration).
create table class_join_requests (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references classes(id) on delete cascade,
  requesting_student_id uuid not null references students(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  created_at timestamptz not null default now(),
  decided_at timestamptz,
  decided_by uuid references auth.users(id) on delete set null
);

create index class_join_requests_class_id_idx on class_join_requests (class_id);
create index class_join_requests_requesting_student_id_idx on class_join_requests (requesting_student_id);

-- One pending request per (class, student) at a time, but a student may
-- re-request after a rejection — so this is a partial index on
-- status = 'pending', not a plain unique constraint on the pair.
create unique index class_join_requests_one_pending_idx
  on class_join_requests (class_id, requesting_student_id) where status = 'pending';

alter table class_join_requests enable row level security;

-- Read-only for clients, no write policy for `authenticated` at all — every
-- write (creating a request, deciding it) goes through a SECURITY DEFINER
-- function below / in the next migration, so status transitions and the
-- accompanying notification rows always happen together, atomically.
create policy "class_join_requests_select_own_as_student" on class_join_requests
  for select to authenticated using (
    is_student() and requesting_student_id = (select id from students where auth_user_id = auth.uid())
  );
create policy "class_join_requests_select_as_coach" on class_join_requests
  for select to authenticated using (
    is_coach() and exists (
      select 1 from classes c where c.id = class_join_requests.class_id and c.coach_id = auth.uid()
    )
  );

-- Resolves the caller's student_id server-side (never trust a client-passed
-- id, matching requireStudent()'s convention) and validates the class is
-- actually Open, isn't the caller's own hosted class, and the caller isn't
-- already a participant or already has a pending request on it. Capacity is
-- only a soft check here (final authority is decide_join_request at
-- approval time, since capacity can fill between request and decision).
create or replace function request_to_join_class(p_class_id uuid)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_student_id uuid;
  v_class classes%rowtype;
  v_joiner_count int;
  v_request_id uuid;
begin
  if not is_student() then
    raise exception 'Only students can request to join a class.';
  end if;

  select id into v_student_id from students where auth_user_id = auth.uid();
  if v_student_id is null then
    raise exception 'No linked student profile found.';
  end if;

  select * into v_class from classes where id = p_class_id;
  if not found then
    raise exception 'Class not found.';
  end if;
  if not v_class.is_open then
    raise exception 'This class is not open for joining.';
  end if;
  if v_class.student_id = v_student_id then
    raise exception 'You are already the student on this class.';
  end if;
  if exists (select 1 from class_participants where class_id = p_class_id and student_id = v_student_id) then
    raise exception 'You have already joined this class.';
  end if;
  if exists (
    select 1 from class_join_requests
    where class_id = p_class_id and requesting_student_id = v_student_id and status = 'pending'
  ) then
    raise exception 'You already have a pending request for this class.';
  end if;

  select count(*) into v_joiner_count from class_participants where class_id = p_class_id;
  if v_joiner_count >= v_class.max_joiners then
    raise exception 'This class is already full.';
  end if;

  insert into class_join_requests (class_id, requesting_student_id)
    values (p_class_id, v_student_id)
    returning id into v_request_id;

  insert into notifications (recipient_id, type, payload)
    values (
      v_class.coach_id,
      'join_request_received',
      jsonb_build_object(
        'request_id', v_request_id,
        'class_id', p_class_id,
        'requesting_student_id', v_student_id,
        'requesting_student_name', (select name from students where id = v_student_id),
        'start_time', v_class.start_time,
        'end_time', v_class.end_time
      )
    );

  return v_request_id;
end;
$$;
revoke execute on function request_to_join_class(uuid) from public, anon;
grant execute on function request_to_join_class(uuid) to authenticated;
