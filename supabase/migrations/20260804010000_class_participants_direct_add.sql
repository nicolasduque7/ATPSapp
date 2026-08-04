-- Direct-add multi-student booking: lets a coach or a class's host student
-- write class_participants rows immediately at booking time (no approval
-- step), additive to the existing Open Class request/approval flow
-- (decide_join_request), which remains the only writer for join-request-
-- approved rows and is otherwise untouched. Both mechanisms write the same
-- table and are validated identically by check_student_conflict, and
-- decide_join_request's `count(*) from class_participants` capacity check
-- already composes correctly with pre-existing direct-added rows with zero
-- changes -- max_joiners already means "additional joiners beyond whoever
-- is already on the roster," regardless of how they got there.

create policy "class_participants_insert_coach" on class_participants
  for insert to authenticated with check (
    is_coach() and exists (
      select 1 from classes c where c.id = class_participants.class_id and c.coach_id = auth.uid()
    )
  );

create policy "class_participants_insert_host_student" on class_participants
  for insert to authenticated with check (
    is_student() and exists (
      select 1 from classes c
      join students s on s.id = c.student_id
      where c.id = class_participants.class_id and s.auth_user_id = auth.uid()
    )
  );

create policy "class_participants_delete_coach" on class_participants
  for delete to authenticated using (
    is_coach() and exists (
      select 1 from classes c where c.id = class_participants.class_id and c.coach_id = auth.uid()
    )
  );

create policy "class_participants_delete_host_student" on class_participants
  for delete to authenticated using (
    is_student() and exists (
      select 1 from classes c
      join students s on s.id = c.student_id
      where c.id = class_participants.class_id and s.auth_user_id = auth.uid()
    )
  );

-- No UPDATE policy: start_time/end_time stay in sync via the existing
-- classes_sync_participants_time trigger (SECURITY DEFINER), and no other
-- column on this table is ever edited in place.

-- A student can't read a classmate's row via students SELECT RLS
-- (students_select_own_linked is self-only) -- narrow, display-fields-only
-- RPC for the "add classmates" picker, same exposure precedent as
-- get_open_classes_for_student.
create or replace function get_addable_students()
returns table (id uuid, name text, nickname text, level student_level)
language sql stable security definer set search_path = public as $$
  select s.id, s.name, s.nickname, s.level
  from students s
  where is_student()
    and s.deactivated_at is null
    and s.auth_user_id is distinct from auth.uid()
  order by s.name;
$$;
revoke execute on function get_addable_students() from public, anon;
grant execute on function get_addable_students() to authenticated;

-- Resolves display names for a set of student ids server-side, so the
-- all-or-nothing conflict-rejection message can name exactly which
-- selected student has the conflict without trusting a client-supplied
-- name for anything security-relevant. Same "expose only display fields"
-- precedent as get_addable_students/get_open_classes_for_student -- a
-- student's name is already visible to any coach/student via those RPCs
-- and via get_class_partner_students, so this isn't a new disclosure.
create or replace function get_student_display_names(p_ids uuid[])
returns table (id uuid, name text)
language sql stable security definer set search_path = public as $$
  select s.id, s.name
  from students s
  where (is_coach() or is_student()) and s.id = any(p_ids);
$$;
revoke execute on function get_student_display_names(uuid[]) from public, anon;
grant execute on function get_student_display_names(uuid[]) to authenticated;
