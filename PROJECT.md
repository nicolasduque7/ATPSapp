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
today's-schedule strip, and the same classes-timeline chart (a line chart
with a dot and count label per day, today's dot highlighted) with
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
Student Home, with a coach-picker instead of a student-picker. A second
toggle, "Other students' Open Classes," shows other students' classes that
have been marked Open (see "Open Class" below) as a distinct, dashed pill;
clicking one opens a read-only summary (student, coach, court, start/end,
level) with a "Request to join" button — the only class event on this
calendar that isn't the viewing student's own.

### Notifications (coach)
At `/notifications`, with a bell icon + unread-count badge in the sidebar.
Shows a "Student's Join Requests" list of pending Open Class join requests
(requester name + class start/end); clicking one opens a read-only full
detail popup with "Authorize this student to join the class?" and Yes/No.

### Student Notifications
At `/student/notifications`, with the same bell + badge pattern. Shows two
directions under "Student's Join Requests": requests this student sent (any
status — pending/approved/rejected, each with an icon), and students who
joined this student's own classes (always approved, since a host is never
notified of a still-pending request). Clicking an item opens class details
(read-only text) plus a card for the other student (Name, Nickname, level,
racket, and their stroke-rating radar chart).

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
  start_time, end_time, duration, completed (bool), [notes?], is_open (bool,
  default false), max_joiners (nullable, additional joiners only)
- ClassParticipant (an approved Open Class joiner): id, class_id, student_id,
  start_time/end_time (denormalized from the class, for double-booking
  protection), joined_at
- ClassJoinRequest (a student's request to join an Open Class): id, class_id,
  requesting_student_id, status (pending/approved/rejected), created_at,
  decided_at, decided_by
- Notification (generic, any recipient/type): id, recipient_id, type (a
  string, not a fixed enum), payload (flexible per type), read_at, created_at

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
  UI nudge, not an actual notification, and is unrelated to the real
  notification system below — see `BACKEND.md`'s known gaps.
- "Open Class": a class can be marked Open, with a capacity for extra
  joiners (additional joiners only, not counting the class's own student).
  This is a **per-instance** toggle, not a series-level one — a brand-new
  recurring series always generates plain Closed instances; opening one
  means editing a generated instance afterward, the same as any other
  single-instance edit. Settable by whoever can already edit that class (the
  hosting coach, or the student themselves for their own classes) — no new
  permission model. A student requests to join from the Student Calendar;
  the request goes to the class's own coach only (not the host student) —
  the host only learns about it once decided, via the real notification
  system below. On approval, the class's type automatically flips to
  'Group' and both students are notified; on rejection, only the requester
  is. See `BACKEND.md` section 11 for the schema.
- A real, generic in-app notification system (not the manual nudge above):
  a bell icon + unread-count badge in both the coach and student sidebars,
  fetched on page load/navigation (no realtime/websockets). Currently
  covers Open Class join requests and decisions; built generically (a
  `type` string + a flexible payload, not a bespoke table per kind) so
  future notification types — e.g. an edit/delete alert — can be added
  without a new migration. See `BACKEND.md` section 12.
- `/signup` is a **coach/student chooser**, not a bare form: it asks "I'm a
  Coach" or "I'm a Student" before showing anything else. The coach path
  shows the existing signup form; the student path shows no form at all —
  just a message pointing them to the invite link their coach sent, since
  students can never self-signup (see the invite system above). This
  exists because a student accidentally landing on a generic signup form
  would create a real coach account under their email, permanently
  blocking that email from ever redeeming their actual invite (Supabase
  emails are unique) — a support cleanup, not just a wrong screen.
- **Google sign-in is built and working end-to-end but intentionally not
  shown in the UI** (`GoogleAuthButton`, `signInWithGoogle`, and the
  `/auth/callback` route all still exist and work, just unreferenced by any
  page). It's deferred, not abandoned: Supabase creates the account the
  instant the OAuth handshake succeeds, with no "confirm first" step
  possible the way a password form allows — which made the accidental-coach-
  signup problem above worse for one-click sign-in specifically. Re-enable
  once there's a safeguard for that (e.g. a post-signup "not what you
  wanted? undo" step), not before.
- Unauthenticated visits to the root `/` land on the coach/student chooser
  (`/signup`) rather than the plain login form — it's the real "who are you"
  entry point for a first-time visitor. Deep links to other protected pages
  (e.g. a stale `/calendar` bookmark, or a session expiring mid-page) still
  redirect to `/login` as before, since that's a returning-user scenario, not
  a first visit.
- The whole app is pinned to one explicit timezone, `CLUB_TIMEZONE =
  "America/Bogota"` (see `BACKEND.md` section 13), rather than trusting
  whatever timezone the rendering server or viewer's device happens to be
  in — a single constant, not a per-location/per-coach setting, since this
  is one shared club/academy, not a multi-region product. Fixes a real
  production bug where the Home dashboard's Classes Timeline chart (and,
  more subtly, class/working-hours times shown elsewhere) could be off by
  a day or an hour for any viewer not in the same timezone as the Vercel
  server (UTC).
- Coach working hours moved from purely descriptive to enforced: once a
  coach + location are picked in the booking form (student or coach side,
  create or edit, one-off or recurring), a suggestion panel shows that
  coach's actual open slots for the selected day (working hours minus
  existing bookings), with a day-bar to browse ahead when the selected day
  has nothing open, plus a dry-run preview for recurring series showing how
  many generated sessions would land free. At submit time, the exact chosen
  time is now validated against the coach's declared working hours the same
  way double-booking already was — a booking outside those hours is
  rejected, using the identical logic the suggestion panel uses so the two
  can never disagree. See `BACKEND.md` section 15.

## Planned (not yet built)
- Re-enable Google sign-in once the accidental-coach-account risk (see
  "Resolved decisions" above) has a proper safeguard, not just the
  coach/student chooser.

## Non-goals (v1)
- Payments, messaging, public booking page (later).