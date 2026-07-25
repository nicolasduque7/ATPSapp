-- Gap found while wiring the student booking dialog: locations has zero
-- student-read policy at all (only locations_select_coach exists), so a
-- student couldn't see the shared location roster to pick where a class
-- happens, or resolve location names on their own calendar tiles.
create policy "locations_select_student" on locations
  for select to authenticated using (is_student());
