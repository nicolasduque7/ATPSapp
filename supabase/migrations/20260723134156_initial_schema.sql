-- CourtSide initial schema

create extension if not exists "pgcrypto";

-- ── Enums ────────────────────────────────────────────────────────────────
-- Mirrors the unions already in src/lib/mock-data.ts, enforced at the DB
-- layer instead of only in TypeScript.
create type court_surface as enum ('Hard', 'Clay', 'Both');
create type student_level as enum ('1ra', '2da', '3ra', '4ta', '5ta', '6ta');
create type gender as enum ('Female', 'Male');
create type hand as enum ('Right', 'Left');
create type class_type as enum ('Private', 'Group', 'Match');

-- ── updated_at helper ───────────────────────────────────────────────────
create function set_updated_at() returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- ── locations ────────────────────────────────────────────────────────────
create table locations (
  id uuid primary key default gen_random_uuid(),
  coach_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  address text,
  surface court_surface not null default 'Hard',
  hard_courts smallint not null default 0,
  clay_courts smallint not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index locations_coach_id_idx on locations (coach_id);

create trigger locations_set_updated_at
  before update on locations
  for each row execute function set_updated_at();

alter table locations enable row level security;

create policy "locations_select_own" on locations
  for select using (coach_id = auth.uid());
create policy "locations_insert_own" on locations
  for insert with check (coach_id = auth.uid());
create policy "locations_update_own" on locations
  for update using (coach_id = auth.uid()) with check (coach_id = auth.uid());
create policy "locations_delete_own" on locations
  for delete using (coach_id = auth.uid());

-- ── students ─────────────────────────────────────────────────────────────
create table students (
  id uuid primary key default gen_random_uuid(),
  coach_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  nickname text,
  level student_level not null,
  age smallint not null check (age > 0 and age < 120),
  gender gender not null,
  hand hand not null,
  racket_type text,
  since date not null default current_date,
  coaching_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index students_coach_id_idx on students (coach_id);

create trigger students_set_updated_at
  before update on students
  for each row execute function set_updated_at();

alter table students enable row level security;

create policy "students_select_own" on students
  for select using (coach_id = auth.uid());
create policy "students_insert_own" on students
  for insert with check (coach_id = auth.uid());
create policy "students_update_own" on students
  for update using (coach_id = auth.uid()) with check (coach_id = auth.uid());
create policy "students_delete_own" on students
  for delete using (coach_id = auth.uid());

-- ── class_series (recurrence rule) ─────────────────────────────────────────
-- One row per recurring pattern (e.g. "every Tue 4pm w/ Ana @ Riverside").
-- All instances are generated up front at creation time, bounded by
-- start_date/end_date — end_date is required, so there is no open-ended
-- recurrence and no background job needed to keep generating instances.
create table class_series (
  id uuid primary key default gen_random_uuid(),
  coach_id uuid not null references auth.users(id) on delete cascade,
  student_id uuid not null references students(id) on delete cascade,
  location_id uuid not null references locations(id) on delete restrict,
  class_type class_type not null default 'Private',
  weekday smallint not null check (weekday between 0 and 6), -- 0 = Monday .. 6 = Sunday
  start_time time not null,
  duration_minutes smallint not null check (duration_minutes > 0),
  start_date date not null,
  end_date date not null check (end_date >= start_date),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index class_series_coach_id_idx on class_series (coach_id);
create index class_series_student_id_idx on class_series (student_id);
create index class_series_location_id_idx on class_series (location_id);

create trigger class_series_set_updated_at
  before update on class_series
  for each row execute function set_updated_at();

alter table class_series enable row level security;

create policy "class_series_select_own" on class_series
  for select using (coach_id = auth.uid());
create policy "class_series_insert_own" on class_series
  for insert with check (coach_id = auth.uid());
create policy "class_series_update_own" on class_series
  for update using (coach_id = auth.uid()) with check (coach_id = auth.uid());
create policy "class_series_delete_own" on class_series
  for delete using (coach_id = auth.uid());

-- ── classes (calendar instances) ───────────────────────────────────────────
-- What the calendar actually reads. series_id is null for one-off classes;
-- deleting the parent series cascades to delete all of its instances, which
-- is exactly the "delete whole series" action.
--
-- start_time/end_time are plain `timestamp` (no tz): coach + students +
-- courts are all assumed to share one local timezone for v1, so we skip
-- timezone-aware storage entirely rather than guess at a per-location zone.
-- Revisit if CourtSide ever supports coaches spanning multiple timezones.
create table classes (
  id uuid primary key default gen_random_uuid(),
  coach_id uuid not null references auth.users(id) on delete cascade,
  student_id uuid not null references students(id) on delete cascade,
  location_id uuid not null references locations(id) on delete restrict,
  series_id uuid references class_series(id) on delete cascade,
  class_type class_type not null default 'Private',
  start_time timestamp not null,
  end_time timestamp not null check (end_time > start_time),
  duration_minutes smallint not null check (duration_minutes > 0),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index classes_coach_id_start_time_idx on classes (coach_id, start_time);
create index classes_student_id_idx on classes (student_id);
create index classes_location_id_idx on classes (location_id);
create index classes_series_id_idx on classes (series_id);

create trigger classes_set_updated_at
  before update on classes
  for each row execute function set_updated_at();

alter table classes enable row level security;

create policy "classes_select_own" on classes
  for select using (coach_id = auth.uid());
create policy "classes_insert_own" on classes
  for insert with check (coach_id = auth.uid());
create policy "classes_update_own" on classes
  for update using (coach_id = auth.uid()) with check (coach_id = auth.uid());
create policy "classes_delete_own" on classes
  for delete using (coach_id = auth.uid());

-- ── completed status ────────────────────────────────────────────────────
-- No stored `completed` column: "now() > end_time" isn't IMMUTABLE, so it
-- can't be a generated column, and a stored bool would need a cron job to
-- flip it on schedule. Instead expose it computed, always accurate with no
-- background job. security_invoker is required here — without it the view
-- would run with the view owner's privileges and silently bypass the RLS
-- policies on `classes`.
create view classes_with_status
  with (security_invoker = true) as
  select *, (now() at time zone 'utc' > end_time) as completed
  from classes;
