-- "Open Class": a class can be marked Open so other students can request to
-- join it, with a coach/host-set capacity for how many extra joiners are
-- allowed (on top of the existing host student). This is a per-instance
-- flag on `classes` itself, not on `class_series` — a recurring series
-- always generates plain Closed instances; opening happens by editing an
-- individual generated instance afterward. capacity is required exactly
-- when open, and represents ADDITIONAL joiners only (not the host).

alter table classes
  add column is_open boolean not null default false,
  add column max_joiners smallint;

alter table classes add constraint classes_open_capacity_check
  check (
    (is_open = false and max_joiners is null)
    or (is_open = true and max_joiners > 0)
  );

-- Students can already only ever read their own classes
-- (classes_select_own_as_student). This is additive: any student may also
-- read classes explicitly marked Open, regardless of who's hosting them —
-- Postgres OR's multiple permissive policies for the same command together,
-- so a student's own classes remain visible even if not Open.
create policy "classes_select_open_as_student" on classes
  for select to authenticated using (is_student() and is_open = true);

-- classes_insert_own_as_student / classes_update_own_as_student / the coach
-- equivalents need no changes — is_open/max_joiners are just new columns on
-- rows already governed by those policies (whoever can already edit a class
-- can set these two fields on it).
