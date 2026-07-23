# CourtSide — Product Spec

## One-liner
Help tennis coaches schedule classes and manage sessions.

## Users
- MULTIPLE coaches. Each coach signs up for their own account and sees ONLY
  their own students, locations, and classes (multi-tenant isolation via a
  coach_id on every row + Row Level Security).
- Students are records the coach manages, NOT login users in v1.

## Pages
### Home (dashboard)
Shows: classes completed today, classes remaining today, next class (time,
student, location), this week's upcoming classes, [+ your extra metrics].

### Calendar
Views: Month, Week, 3-Day, Day. Each event shows start–end, duration, student
name, student level, location tag. Actions: book a class (one-off OR recurring),
edit a class, DELETE a class (hard delete — no cancellation status).

### Locations
Create/edit/delete locations. Each location is a tag shown on calendar events.

### Students
Create/edit/delete students. Fields: name, nickname, level, age, gender,
racket type. Name + level shown on calendar events.

## Scheduling model (IMPORTANT)
Coaches can create TWO kinds of classes:
1. **One-off class** — a single class at any date/time the student wants.
2. **Recurring class** — a repeating pattern (e.g. every Tuesday 4:00pm, 60 min)
   that generates individual class instances on the calendar.
Both appear on the calendar as normal class instances. Deleting removes the
single instance. (Also offer "delete this whole series" for recurring classes.)

## Data model
- Coach (Supabase auth user): id, name, email
- Location: id, coach_id, name, [address?]
- Student: id, coach_id, name, nickname, level, age, gender, racket_type
- ClassSeries (recurrence rule, ONLY for recurring): id, coach_id, student_id,
  location_id, frequency (Daily/Weekly/Monthly), interval_count ("every N"
  days/weeks/months), weekdays (multi-select, Weekly only), day_of_month
  (1-30, Monthly only), start_time, duration, start_date, end_date (required)
- Class (a single instance on the calendar — this is what the calendar reads):
  id, coach_id, student_id, location_id, series_id (nullable — null = one-off),
  start_time, end_time, duration, completed (bool), [notes?]

## Resolved decisions
- Recurring classes: YES, alongside one-off classes (see scheduling model).
- Deleting a class: hard delete. No cancellation status.
- Accounts: multiple coaches, each isolated to their own data.
- ClassSeries end_date: required (no indefinite recurrences).
- Recurring class instances: generated up-front on series creation.
- Editing a recurring class: two options — (a) this instance only, or (b) the
  whole series (whole-series edits regenerate future instances only; past/
  completed ones are left alone). The "this and all future instances" middle
  option from the original plan was dropped in favor of this simpler model.
- A series' frequency (Daily/Weekly/Monthly) is locked at creation — editing
  the whole series can change its interval, weekdays/day-of-month, time,
  location, and type, but not the frequency itself. To change frequency,
  delete the series and create a new one.
- Weekly series support multiple weekdays (e.g. Mon + Wed) as ONE combined
  series — not one series per weekday — so "whole series" edit/delete acts
  on all selected weekdays together.
- Monthly series: if the chosen day-of-month (1-30) doesn't exist in a given
  month (e.g. day 30 in February), that occurrence clamps to the month's
  last day rather than being skipped.
- `completed` flag: auto-set when now > end_time (dashboard reads this flag, which effectively mirrors the clock).
- Calendar booking flow: one form with a one-off/recurring toggle; recurrence fields appear when toggle is on.
- Home dashboard extra metric: weekly hours coached.
- Students page: list view showing name, nickname pill, and level pill per student. Clicking a student opens a pop-up with their full profile at the top and their upcoming classes below.
- Coach name: pulled automatically from the auth provider on sign-up; no separate onboarding step.

## Non-goals (v1)
- Payments, messaging, student self-service booking / public booking page (later).