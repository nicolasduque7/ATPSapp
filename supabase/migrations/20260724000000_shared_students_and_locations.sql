-- Students and locations become a shared club-wide roster/facility list:
-- every coach can see, book with, edit, and delete any student or location.
-- `coach_id` on these two tables is kept only as a "who originally added
-- this" audit field — it no longer drives access control.
--
-- Classes and class_series stay exactly as private as before: RLS on those
-- tables is untouched, so each coach only ever sees and manages their own
-- bookings, even though those bookings now reference the shared students
-- and locations.

-- ── locations: open up to every authenticated coach ────────────────────────
drop policy "locations_select_own" on locations;
drop policy "locations_insert_own" on locations;
drop policy "locations_update_own" on locations;
drop policy "locations_delete_own" on locations;

create policy "locations_select_shared" on locations
  for select to authenticated using (true);
create policy "locations_insert_shared" on locations
  for insert to authenticated with check (true);
create policy "locations_update_shared" on locations
  for update to authenticated using (true) with check (true);
create policy "locations_delete_shared" on locations
  for delete to authenticated using (true);

-- ── students: open up to every authenticated coach ──────────────────────────
drop policy "students_select_own" on students;
drop policy "students_insert_own" on students;
drop policy "students_update_own" on students;
drop policy "students_delete_own" on students;

create policy "students_select_shared" on students
  for select to authenticated using (true);
create policy "students_insert_shared" on students
  for insert to authenticated with check (true);
create policy "students_update_shared" on students
  for update to authenticated using (true) with check (true);
create policy "students_delete_shared" on students
  for delete to authenticated using (true);

-- ── student deletes now behave like location deletes: blocked, not cascaded ─
-- Previously deleting a student cascade-deleted every class booked with
-- them. Now that students are shared, one coach deleting a student could
-- silently wipe another coach's class history. Require classes/series
-- referencing a student to be cleared first, matching how locations
-- (on delete restrict) already behave.
alter table classes drop constraint classes_student_id_fkey;
alter table classes add constraint classes_student_id_fkey
  foreign key (student_id) references students(id) on delete restrict;

alter table class_series drop constraint class_series_student_id_fkey;
alter table class_series add constraint class_series_student_id_fkey
  foreign key (student_id) references students(id) on delete restrict;
