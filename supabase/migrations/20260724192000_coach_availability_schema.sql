-- Coach working hours: a coach can declare when (and at which locations)
-- they're available to teach, so it can be overlaid on the Calendar as its
-- own toggleable layer. Purely descriptive — no exclusion constraint (a
-- coach may have overlapping entries, e.g. a one-off adjustment layered
-- over a standing recurring block) and no validation tying class bookings
-- to declared hours.
--
-- Structurally this mirrors class_series/classes: a recurrence rule table
-- (coach_availability_series) whose occurrences are generated up front,
-- bounded by a required end_date, into concrete instance rows
-- (coach_availability_blocks) — series_id is null for one-off blocks.

create type coach_availability_frequency as enum ('Daily', 'Weekly', 'Monthly');

create table coach_availability_series (
  id uuid primary key default gen_random_uuid(),
  coach_id uuid not null references auth.users(id) on delete cascade,
  frequency coach_availability_frequency not null,
  interval_count smallint not null default 1 check (interval_count > 0),
  weekdays smallint[],
  day_of_month smallint check (day_of_month between 1 and 30),
  start_time time not null,
  end_time time not null check (end_time > start_time),
  location_ids uuid[] not null check (cardinality(location_ids) > 0),
  start_date date not null,
  end_date date not null check (end_date >= start_date),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table coach_availability_series
  add constraint availability_weekdays_within_range check (
    weekdays is null or weekdays <@ array[0,1,2,3,4,5,6]::smallint[]
  ),
  add constraint availability_frequency_fields_consistent check (
    (frequency = 'Daily' and weekdays is null and day_of_month is null)
    or (frequency = 'Weekly' and weekdays is not null and array_length(weekdays, 1) > 0 and day_of_month is null)
    or (frequency = 'Monthly' and weekdays is null and day_of_month is not null)
  );

create index coach_availability_series_coach_id_idx on coach_availability_series (coach_id);

create trigger coach_availability_series_set_updated_at
  before update on coach_availability_series
  for each row execute function set_updated_at();

alter table coach_availability_series enable row level security;

-- Select is shared club-wide (any coach can see any coach's declared
-- hours); writes stay coach-private, same shape as classes/class_series.
create policy "coach_availability_series_select_coach" on coach_availability_series
  for select to authenticated using (is_coach());
create policy "coach_availability_series_insert_own" on coach_availability_series
  for insert to authenticated with check (is_coach() and coach_id = auth.uid());
create policy "coach_availability_series_update_own" on coach_availability_series
  for update to authenticated using (is_coach() and coach_id = auth.uid()) with check (is_coach() and coach_id = auth.uid());
create policy "coach_availability_series_delete_own" on coach_availability_series
  for delete to authenticated using (is_coach() and coach_id = auth.uid());

create table coach_availability_blocks (
  id uuid primary key default gen_random_uuid(),
  coach_id uuid not null references auth.users(id) on delete cascade,
  series_id uuid references coach_availability_series(id) on delete cascade,
  location_ids uuid[] not null check (cardinality(location_ids) > 0),
  start_time timestamp not null,
  end_time timestamp not null check (end_time > start_time),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index coach_availability_blocks_coach_id_start_time_idx on coach_availability_blocks (coach_id, start_time);
create index coach_availability_blocks_series_id_idx on coach_availability_blocks (series_id);

create trigger coach_availability_blocks_set_updated_at
  before update on coach_availability_blocks
  for each row execute function set_updated_at();

alter table coach_availability_blocks enable row level security;

create policy "coach_availability_blocks_select_coach" on coach_availability_blocks
  for select to authenticated using (is_coach());
create policy "coach_availability_blocks_insert_own" on coach_availability_blocks
  for insert to authenticated with check (is_coach() and coach_id = auth.uid());
create policy "coach_availability_blocks_update_own" on coach_availability_blocks
  for update to authenticated using (is_coach() and coach_id = auth.uid()) with check (is_coach() and coach_id = auth.uid());
create policy "coach_availability_blocks_delete_own" on coach_availability_blocks
  for delete to authenticated using (is_coach() and coach_id = auth.uid());
