-- Coaches can now see every coach's booked classes (not just their own), so
-- a shared student's schedule and cross-coach double-bookings are visible
-- on the Calendar. Writes stay exactly as private as before — a coach can
-- only ever insert/update/delete their own bookings. class_series is left
-- untouched (still fully coach-private): no UI needs another coach's
-- recurrence rule, only the materialized instances (which already carry
-- series_id for the "recurring" tag).

drop policy "classes_select_own" on classes;
create policy "classes_select_coach" on classes
  for select to authenticated using (is_coach());
