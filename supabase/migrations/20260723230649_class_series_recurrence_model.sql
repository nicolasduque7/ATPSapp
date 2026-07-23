-- Expands class_series from "one weekday, every single week" into a fuller
-- recurrence model: Daily / Weekly / Monthly, with an interval ("every N"),
-- multiple weekdays for Weekly (one combined series, not one per weekday),
-- and a day-of-month for Monthly.

create type series_frequency as enum ('Daily', 'Weekly', 'Monthly');

alter table class_series
  add column frequency series_frequency not null default 'Weekly',
  add column interval_count smallint not null default 1 check (interval_count > 0),
  add column weekdays smallint[],
  add column day_of_month smallint check (day_of_month between 1 and 30);

-- Carry every existing row's single weekday into the new array column
-- before the old column is dropped, so no recurring series loses data.
update class_series set weekdays = array[weekday];

alter table class_series drop column weekday;

alter table class_series
  add constraint weekdays_within_range check (
    weekdays is null or weekdays <@ array[0,1,2,3,4,5,6]::smallint[]
  ),
  add constraint frequency_fields_consistent check (
    (frequency = 'Daily' and weekdays is null and day_of_month is null)
    or (frequency = 'Weekly' and weekdays is not null and array_length(weekdays, 1) > 0 and day_of_month is null)
    or (frequency = 'Monthly' and weekdays is null and day_of_month is not null)
  );

alter table class_series alter column frequency drop default;
