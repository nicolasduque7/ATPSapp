-- Editing an existing class (or whole series) must not have that class's own
-- current booking count as "busy" against itself in the suggestion panel's
-- free-window computation -- otherwise a student/coach editing a class would
-- see their own already-booked time incorrectly marked unavailable. Adds two
-- optional, backward-compatible trailing params to get_coach_busy_intervals:
-- p_exclude_class_id for editing a single instance, p_exclude_series_id for
-- editing a whole series (which regenerates ALL of that series' future
-- instances at submit time, so every one of its current rows must be
-- excluded, not just the one instance the student/coach clicked into).
--
-- The old 3-parameter overload must be dropped first: a bare `create or
-- replace` with 2 extra defaulted params declares a DIFFERENT signature (by
-- parameter count), which would leave both overloads registered and make any
-- 3-argument call ("p_coach_id, p_from, p_to" only) ambiguous between them.
drop function if exists get_coach_busy_intervals(uuid, timestamp, timestamp);

create or replace function get_coach_busy_intervals(
  p_coach_id uuid,
  p_from timestamp,
  p_to timestamp,
  p_exclude_class_id uuid default null,
  p_exclude_series_id uuid default null
)
returns table (
  start_time timestamp,
  end_time timestamp
)
language sql
security definer
set search_path = public
as $$
  select c.start_time, c.end_time
  from classes c
  where c.coach_id = p_coach_id
    and tsrange(c.start_time, c.end_time) && tsrange(p_from, p_to)
    and (p_exclude_class_id is null or c.id != p_exclude_class_id)
    and (p_exclude_series_id is null or c.series_id is distinct from p_exclude_series_id)
  order by c.start_time;
$$;

revoke execute on function get_coach_busy_intervals(uuid, timestamp, timestamp, uuid, uuid) from public;
revoke execute on function get_coach_busy_intervals(uuid, timestamp, timestamp, uuid, uuid) from anon;
grant execute on function get_coach_busy_intervals(uuid, timestamp, timestamp, uuid, uuid) to authenticated;
