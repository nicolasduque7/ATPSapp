-- Prevent double-booking a student: nothing today stops two different
-- coaches (or the same coach) from booking the same shared student at
-- overlapping times, since classes/class_series RLS scopes rows per-coach
-- and doesn't compare across coaches at all.
--
-- Two layers:
-- 1. A hard database guarantee (exclusion constraint) — makes an
--    overlapping insert/update physically impossible, enforced by Postgres
--    regardless of code path.
-- 2. A SECURITY DEFINER helper function the app calls before writing, to
--    give a specific, friendly error ("already booked with <coach>, <time>")
--    instead of a raw constraint-violation message. It must bypass RLS,
--    since a normal query literally cannot see another coach's rows.

-- ── layer 1: the guarantee ──────────────────────────────────────────────────
-- Required for the "with =" / "with &&" exclusion operators below.
create extension if not exists btree_gist;

-- tsrange's default bounds are '[)' (inclusive start, exclusive end), so a
-- class ending at 9:00 and another starting at 9:00 for the same student
-- are correctly treated as back-to-back, not overlapping.
alter table classes add constraint classes_no_student_overlap
  exclude using gist (student_id with =, tsrange(start_time, end_time) with &&);

-- ── layer 2: the friendly messenger ─────────────────────────────────────────
-- Returns the conflicting class's coach name/start/end if the given student
-- is already booked over the given range, excluding the row being edited
-- (so updating a class doesn't flag itself as conflicting with itself).
create or replace function check_student_conflict(
  p_student_id uuid,
  p_start_time timestamp,
  p_end_time timestamp,
  p_exclude_class_id uuid default null
)
returns table (
  coach_name text,
  start_time timestamp,
  end_time timestamp
)
language sql
security definer
set search_path = public
as $$
  select
    coalesce(u.raw_user_meta_data ->> 'full_name', u.email) as coach_name,
    c.start_time,
    c.end_time
  from classes c
  join auth.users u on u.id = c.coach_id
  where c.student_id = p_student_id
    and tsrange(c.start_time, c.end_time) && tsrange(p_start_time, p_end_time)
    and (p_exclude_class_id is null or c.id != p_exclude_class_id)
  limit 1;
$$;

grant execute on function check_student_conflict(uuid, timestamp, timestamp, uuid) to authenticated;
