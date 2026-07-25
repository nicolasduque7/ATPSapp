# CourtSide — Product Spec

## One-liner
Help tennis coaches schedule classes and manage sessions.

## Users
- MULTIPLE coaches, one shared club/academy. Every coach signs in with their
  own account, but students and locations are a single shared pool everyone
  can see, book with, edit, and delete — any coach can schedule a class with
  any student at any location.
- Classes (and recurring series) stay private per coach: each coach only
  sees and manages the classes THEY booked, enforced via coach_id + Row
  Level Security on the classes/class_series tables. Locations and students
  use open Row Level Security instead — coach_id on those two tables is kept
  only as a "who originally added this" audit field, not an access boundary.
- Students CAN now have their own login (added post-v1-launch, see
  `BACKEND.md`): a coach invites a student by email from their existing
  roster record, and the student's account links to that exact record on
  signup — there's no open self-signup for students. A linked student now
  has their own Home dashboard and Calendar (see Pages below) and can book,
  edit, and delete their own classes — one-off or recurring — with any
  coach, immediately (no coach-approval step). They still can't edit their
  own profile fields (level, notes, stroke ratings, etc. remain
  coach-write-only).

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
racket type. Name + level shown on calendar events. Coaches also set 6
stroke-strength ratings (Forehand, Backhand, Backhand Slice, Volley, Serve,
Drop-shot; 0-100 each) from the student's profile — read-only for the
student, shown on their own dashboard's radar chart.

### Student Home (dashboard)
The student-facing counterpart to the coach Home dashboard, at `/student`.
Shows: next upcoming class (coach, location, time — with a "Book a class"
button always available top-right), today's classes completed/remaining
(activity ring), a stroke-strength radar chart (the 6 ratings above), hours
trained today, this week's classes/coaches-trained-with/busiest-day, a
today's-schedule strip, and the same classes-timeline bar chart with
time-range slider as the coach dashboard. A student can click into their
next class to edit or delete it.

### Student Calendar
The student-facing counterpart to the coach Calendar, at `/student/calendar`.
Same Month/Week/3-Day/Day views and event-pill styling as the coach
Calendar, showing only the student's own classes (always labeled with which
coach, since a student's classes legitimately span multiple coaches). A
"Coaches' working hours" toggle overlays coaches' declared availability,
read-only — clicking a working-hours block does nothing, only class events
open the edit dialog. The "+" button opens the same booking dialog as
Student Home, with a coach-picker instead of a student-picker.

## Scheduling model (IMPORTANT)
Coaches can create TWO kinds of classes:
1. **One-off class** — a single class at any date/time the student wants.
2. **Recurring class** — a repeating pattern (e.g. every Tuesday 4:00pm, 60 min)
   that generates individual class instances on the calendar.
Both appear on the calendar as normal class instances. Deleting removes the
single instance. (Also offer "delete this whole series" for recurring classes.)

## Data model
- Coach (Supabase auth user): id, name, email
- Location: id, coach_id (who added it — shared across all coaches, not an access boundary), name, [address?]
- Student: id, coach_id (who added them — shared across all coaches, not an access boundary), name, nickname, level, age, gender, racket_type, forehand_rating, backhand_rating, backhand_slice_rating, volley_rating, serve_rating, drop_shot_rating (all six ratings 0-100, coach-set only)
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
- Accounts: multiple coaches. Students and locations are shared club-wide
  (any coach can view, book, edit, or delete any student or location); classes
  and recurring series remain private to the coach who booked them.
- Deleting a student is blocked (not cascaded) if any coach still has a class
  or series referencing them — matches how deleting a location already
  behaves. Prevents one coach from silently wiping another coach's class
  history by removing a shared student.
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
- Calendar visibility across coaches: coaches can toggle on other coaches'
  booked classes and declared working hours on their own Calendar (off by
  default), so a coach can spot and avoid double-booking a shared student.
- Student self-booking: a student picks a coach explicitly (no implied
  single coach), books immediately with no coach-approval step, and can
  book recurring series with the same Daily/Weekly/Monthly options a coach
  has. A student can edit or delete ANY class where they're the student —
  including ones a coach booked for them, not just ones they self-booked.
- Student stroke ratings: 6 categories (Forehand, Backhand, Backhand Slice,
  Volley, Serve, Drop-shot), 0-100, coach-set only — shown to the student
  read-only as a radar chart on their own dashboard.
- A small "Don't forget to notify the coach/student about these changes"
  reminder (warning icon, dismissible dialog) appears after editing or
  deleting a class, on both the coach and student interfaces. It's a manual
  UI nudge, not an actual notification — see `BACKEND.md`'s known gaps.

## Planned (not yet built)
- "Open Class": a class can be marked Open or Closed so other students can
  join it. Scope already decided: any class type, coach-set capacity. This
  needs a new multi-student-per-class data model (`classes` is currently
  strictly one student per row) and a rework of both double-booking
  exclusion constraints, which are keyed on `classes.student_id` and
  `classes.coach_id` today. See `BACKEND.md` for the current schema this
  has to build on.

## Non-goals (v1)
- Payments, messaging, public booking page (later).