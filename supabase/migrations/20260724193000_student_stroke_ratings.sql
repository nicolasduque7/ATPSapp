-- Stroke-strength ratings (0-100) for the student Home dashboard's radar
-- chart. Coach-set only, student-read-only. No RLS changes needed: the
-- existing students_update_coach (coach-only write) and
-- students_select_own_linked / students_select_coach (read) policies
-- already cover any column on this table, including these new ones.

alter table students
  add column forehand_rating smallint not null default 0 check (forehand_rating between 0 and 100),
  add column backhand_rating smallint not null default 0 check (backhand_rating between 0 and 100),
  add column backhand_slice_rating smallint not null default 0 check (backhand_slice_rating between 0 and 100),
  add column volley_rating smallint not null default 0 check (volley_rating between 0 and 100),
  add column serve_rating smallint not null default 0 check (serve_rating between 0 and 100),
  add column drop_shot_rating smallint not null default 0 check (drop_shot_rating between 0 and 100);
