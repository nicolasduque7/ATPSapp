-- Deactivating a student/location hides it from active lists/pickers
-- without hard-deleting it — sidesteps the classes/class_series FK
-- (on delete restrict) that blocks hard delete whenever any class, past or
-- future, still references the row. No RLS change needed: both tables
-- already have open update policies covering any authenticated coach.

alter table students add column deactivated_at timestamptz;
alter table locations add column deactivated_at timestamptz;

create index students_active_idx on students (name) where deactivated_at is null;
create index locations_active_idx on locations (name) where deactivated_at is null;
