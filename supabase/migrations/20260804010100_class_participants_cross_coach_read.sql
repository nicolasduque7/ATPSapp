-- classes_select_coach (cross_coach_class_visibility migration) already lets
-- any coach read every class club-wide, including another coach's Group/
-- Match host student, via the Calendar's cross-coach visibility toggle. The
-- existing class_participants_select_coach policy didn't get the same
-- widening -- it's still scoped to "a class I coach", so a coach browsing
-- ANOTHER coach's classes via that same toggle could see the host but not
-- the rest of a directly-added roster. This is the same exposure any coach
-- already has (every class's host, every student's name club-wide), just
-- extended to the "who else is on this class" list for consistency.
create policy "class_participants_select_all_coaches" on class_participants
  for select to authenticated using (is_coach());
