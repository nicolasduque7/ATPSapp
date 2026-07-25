-- Read-only access students need for the Student Calendar's "Coaches'
-- working hours" toggle and the booking dialog's coach-picker.

-- Club-wide read of materialized working-hours blocks, mirroring
-- coach_availability_blocks_select_coach's shape. Deliberately NOT extended
-- to coach_availability_series — same precedent as class_series: no UI
-- needs another coach's recurrence rule, only the materialized instances.
create policy "coach_availability_blocks_select_student" on coach_availability_blocks
  for select to authenticated using (is_student());

-- Students need to resolve coach display names for the coach-picker and the
-- availability toggle's per-coach labels — mirrors
-- profiles_select_coach_directory's shape.
create policy "profiles_select_student_directory" on profiles
  for select to authenticated using (is_student() and role = 'coach');
