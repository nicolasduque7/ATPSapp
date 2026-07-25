-- Prevent double-booking a COACH: the only overlap protection that exists
-- today (classes_no_student_overlap + check_student_conflict) is keyed on
-- student_id only. Nothing stops two different students from booking the
-- same coach at overlapping times — a latent gap even today (a coach could
-- manually double-book themselves across two students), but one that becomes
-- a real, likely-to-happen problem once students can each independently pick
-- any coach and self-book. Fix, symmetric to the student-side protection:
--
-- 1. A hard database guarantee (exclusion constraint), same shape as
--    classes_no_student_overlap but keyed on coach_id.
-- 2. A SECURITY DEFINER helper for a friendly "already booked with <student>"
--    message ahead of the raw constraint violation.

alter table classes add constraint classes_no_coach_overlap
  exclude using gist (coach_id with =, tsrange(start_time, end_time) with &&);

-- Unlike check_student_conflict, no is_coach()/is_student() guard is needed
-- here: the caller always passes an explicit p_coach_id, and there's no
-- "whose schedule is this" ambiguity to protect against the way there is for
-- an arbitrary p_student_id — a coach checking their own id and a student
-- checking their chosen coach's id are both legitimate, non-snooping uses.
create or replace function check_coach_conflict(
  p_coach_id uuid,
  p_start_time timestamp,
  p_end_time timestamp,
  p_exclude_class_id uuid default null
)
returns table (
  student_name text,
  start_time timestamp,
  end_time timestamp
)
language sql
security definer
set search_path = public
as $$
  select
    s.name as student_name,
    c.start_time,
    c.end_time
  from classes c
  join students s on s.id = c.student_id
  where c.coach_id = p_coach_id
    and tsrange(c.start_time, c.end_time) && tsrange(p_start_time, p_end_time)
    and (p_exclude_class_id is null or c.id != p_exclude_class_id)
  limit 1;
$$;

revoke execute on function check_coach_conflict(uuid, timestamp, timestamp, uuid) from public;
revoke execute on function check_coach_conflict(uuid, timestamp, timestamp, uuid) from anon;
grant execute on function check_coach_conflict(uuid, timestamp, timestamp, uuid) to authenticated;
