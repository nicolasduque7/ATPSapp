-- Proactive available-slot suggestions for student booking: the student
-- booking form can already read a coach's declared working-hours blocks
-- directly (coach_availability_blocks_select_student), but cannot read
-- other students'/coaches' `classes` rows to know which of those hours are
-- already booked (RLS scopes `classes` reads to the caller's own bookings or
-- open classes) -- the same wall check_coach_conflict exists to get around.
-- get_coach_busy_intervals is the read-only equivalent for a date RANGE
-- (not a single overlap check), used to compute free/busy slots client-side
-- in src/lib/actions/availability-suggestions.ts. Deliberately returns only
-- times, no student name -- narrower than check_coach_conflict, since this
-- call's only job is "is the coach busy," not "who with."
create or replace function get_coach_busy_intervals(
  p_coach_id uuid,
  p_from timestamp,
  p_to timestamp
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
  order by c.start_time;
$$;

revoke execute on function get_coach_busy_intervals(uuid, timestamp, timestamp) from public;
revoke execute on function get_coach_busy_intervals(uuid, timestamp, timestamp) from anon;
grant execute on function get_coach_busy_intervals(uuid, timestamp, timestamp) to authenticated;

-- Recurring-booking dry-run preview: a series applies ONE fixed time-of-day
-- across every generated occurrence, so "is this pattern actually free" is a
-- whole-series question, not a single-day one. Bulk-checks every occurrence
-- in one round trip instead of looping check_student_conflict/
-- check_coach_conflict per date from the client (fine at submit time, too
-- slow to re-run reactively while the student is still tuning the pattern).
-- Advisory only -- does not change how createStudentClassSeries itself
-- validates/creates; that action keeps its own sequential per-occurrence
-- check and all-or-nothing abort exactly as before.
create or replace function check_series_conflicts_bulk(
  p_student_id uuid,
  p_coach_id uuid,
  p_starts timestamp[],
  p_ends timestamp[]
)
returns table (
  occurrence_index int,
  has_conflict boolean
)
language sql
security definer
set search_path = public
as $$
  select
    o.occurrence_index,
    exists (
      select 1 from classes c
      where tsrange(c.start_time, c.end_time) && tsrange(o.start_time, o.end_time)
        and (c.student_id = p_student_id or c.coach_id = p_coach_id)
    ) as has_conflict
  from (
    select ord - 1 as occurrence_index, s as start_time, e as end_time
    from unnest(p_starts, p_ends) with ordinality as u(s, e, ord)
  ) o;
$$;

revoke execute on function check_series_conflicts_bulk(uuid, uuid, timestamp[], timestamp[]) from public;
revoke execute on function check_series_conflicts_bulk(uuid, uuid, timestamp[], timestamp[]) from anon;
grant execute on function check_series_conflicts_bulk(uuid, uuid, timestamp[], timestamp[]) to authenticated;
