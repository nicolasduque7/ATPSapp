# CourtSide — Backend Decisions (plain English)

This file explains every backend decision in CourtSide — what we built, **why**
we built it that way, and **which frontend code depends on it**. It's written
so a non-backend person can follow it. Read `PROJECT.md` first for the
product spec; this file is about how the database and server code actually
implement that spec.

Keep this file up to date: **any time a backend decision changes — a new
table, a new RLS policy, a new role, a new server-side rule — update this
file in the same change.** (This is also written into `CLAUDE.md`.)

---

## The stack, in one paragraph

The database is Postgres, hosted by Supabase. Supabase also gives us
authentication (login/signup) and "Row Level Security" (RLS) — a Postgres
feature where the database itself, not our app code, decides which rows a
given logged-in user is allowed to see or change. All of our server-side
code (`src/lib/actions/*`, `src/lib/queries/*`) talks to Postgres through a
Supabase client that carries the current user's identity, so RLS is always
in effect — there's no way for our Next.js code to accidentally "forget" to
filter something.

---

## 1. Coaches, students, and who can see what

### The roster tables: `locations` and `students`
These are a **shared club-wide roster** — any coach can view, book with,
edit, or delete any location or student. Think of it like a shared address
book the whole club uses together, not something each coach owns privately.
`coach_id` still exists on these tables, but it's just a "who originally
added this" note — it has no effect on who can read or edit the row.

**Why:** the product is multiple coaches at one shared academy. A student
might train with more than one coach, so locking a student record to "only
the coach who typed it in" would mean other coaches literally couldn't see
or book that student. Shared roster, private schedules (below) is the model.

**Front-end connection:** `src/app/(app)/students/page.tsx`,
`src/app/(app)/locations/page.tsx`, and the dialogs in
`src/components/students/` and `src/components/locations/` all just read
and write these tables normally — they don't need to know or care who
originally added a given student or location.

### The schedule tables: `classes` and `class_series`
These stay **private per coach** — a coach only ever sees and manages the
classes *they* booked. Even though the student and location on a class are
shared, the booking itself belongs to one coach.

**Why:** a coach's calendar is their own work schedule. Two coaches booking
the same shared student is a real thing that can happen (see the
double-booking section below) — but each coach's *view* of their day should
only show their own commitments, not everyone else's.

**Front-end connection:** `src/app/(app)/calendar/page.tsx` and
`src/app/(app)/page.tsx` (Home) both only ever render the signed-in coach's
own classes — there's no code path today that shows another coach's
schedule (see "Known gaps" below).

---

## 2. Preventing double-booking a student, and a coach

**The problem:** a shared student could get booked by two different coaches
(or the same coach twice) at overlapping times, with nothing stopping it.
Once students could self-book with any coach (see section 8), the mirror
problem became just as real: two different students independently booking
the *same coach* at overlapping times, with nothing stopping that either —
this was actually a latent gap even before student booking existed (a coach
could always have accidentally double-booked themselves across two
students), it just became far more likely once bookings could come from
independent, mutually-invisible callers.

**Both directions get the same two-layer fix, applied twice — once keyed on
`student_id`, once keyed on `coach_id`:**
1. **A hard rule inside the database** (an "exclusion constraint" on
   `classes`): Postgres itself refuses to store two rows for the same
   student — or, separately, for the same coach — with overlapping
   start/end times, no matter which caller or which code path tries to
   insert them. This is the real guarantee — it can't be bypassed by a bug
   in our app code. (`classes_no_student_overlap` and
   `classes_no_coach_overlap`.)
2. **A friendly pre-check** (`check_student_conflict` / `check_coach_conflict`,
   database functions): before saving, our server code asks "is this student
   free at this time?" and "is this coach free at this time?", and if not,
   shows a specific message naming the conflicting party and time, instead of
   a raw database error. Because these need to look across *every* coach's
   classes (not just the signed-in coach's), and normal queries can't see
   other coaches' rows, both functions run with a special "security definer"
   permission — narrowly scoped to answering just this one yes/no question,
   nothing else. `check_student_conflict` additionally guards against a
   student caller probing an *unrelated* student's schedule: a student only
   gets a real answer when checking their own `student_id`.
   `check_coach_conflict` needs no such guard — a coach's schedule isn't
   private the way another student's is, so any caller checking any coach's
   id is a legitimate, non-snooping use.

**Front-end connection:** `src/lib/actions/class-shared.ts` holds both
`assertNoStudentConflict` and `assertNoCoachConflict` (extracted out of
`src/lib/actions/classes.ts` so the student-facing actions in
`src/lib/actions/student-classes.ts`, see section 8, could import them
too — a `"use server"` file can only export async functions, so the shared
helpers had to move to a plain module). Every place a class gets created or
edited, on both the coach side (`createClass`, `createClassSeries`,
`updateClassSeries`, `updateClassInstance`) and the student side
(`createStudentClass`, `createStudentClassSeries`, `updateStudentClassSeries`,
`updateStudentClassInstance`), calls *both* checks before writing. If either
finds a conflict, the booking dialog shows the message as ordinary red
form-error text — no special UI was needed, since that error-display
plumbing already existed.

---

## 3. Coach vs. student accounts (the `profiles` table)

Originally, every person who could log in was a coach — full stop, no
exceptions, nothing in the database even recorded "this person is a coach."
That stopped being safe the moment students needed their own logins too
(see below), so we introduced a **role**.

**How it works:** a new `profiles` table has one row per logged-in person,
holding `role: 'coach' | 'student'`. A person can never set or change their
own role — only the server-side invite system (below) can write to this
table. Every place in our code that needs to check "is this person allowed
to act as a coach?" asks this table (via two small helper functions,
`is_coach()` / `is_student()`), including the database's own RLS rules —
not just our Next.js code. That matters: even if someone tried to bypass our
app entirely and hit the database directly, the same rule applies.

**Why this matters — a real hole we closed:** before this, the roster
tables (`locations`/`students`) and the insert rule on `classes`/
`class_series` only checked "is this a real logged-in user?" — not "is this
person a coach?" The moment student logins existed, a student account would
have silently inherited full coach-level power: editing/deleting any shared
student or location, or even creating fake classes under their own name.
Adding the role check to every one of those rules closed that hole.

**Front-end connection:** `src/lib/auth.ts` has two functions,
`requireCoach()` and `requireStudent()`, that every protected page/action
calls at the very top. `requireCoach()` now checks the role and sends
non-coaches to `/student` instead of showing them coach pages.

---

## 4. How a student gets a login (the invite system)

Students are **not** open self-signup — a coach has to invite them, and the
invite links to a specific existing student roster record. This was a
deliberate choice: students already exist as plain data (name, level, age…)
before they ever have an account, and there's no reliable way to auto-match
a new signup to the "right" existing student by email alone (typos, two
students with the same name, etc.) — a coach vouching for the match removes
that ambiguity entirely.

**The flow, in plain steps:**
1. A coach opens a student's profile, types an email, and clicks **Invite**.
   This creates an "invite" record with a random one-time link and a 7-day
   expiry, and shows the coach a link to copy and send however they like
   (text, email, WhatsApp — there's no automated email sending yet, see
   "Known gaps").
2. The student opens that link. It shows them who invited them and which
   student record they'd be joining as, then asks for a password.
3. When they submit, the moment their account is created, the database
   automatically: marks the invite as used, links their new login to that
   exact student record, and sets their role to `'student'` — all as one
   atomic step, so there's no in-between state where an account exists but
   isn't linked to anything yet.
4. If the link is expired, already used, or the email doesn't match exactly
   what the coach entered, the whole signup is rejected with a clear reason
   — nothing gets half-created.

**Why the invite link needs its own route rule:** every route in this app is
gated by `src/proxy.ts` (this project's Next.js 16 "Proxy" — the renamed
successor to the old `middleware.ts` convention). It redirects any
logged-out visitor to `/login` for every page except a small allowlist. The
invite page is visited by someone who, by definition, doesn't have an
account yet — so `/invite` **must** be in that allowlist
(`isPublicRoute` in `src/proxy.ts`), or every real invite link bounces
logged-out visitors straight to `/login` before they ever see it. This was
missed when the invite feature first shipped and caused exactly that bug —
if you ever see a public, pre-login page "not working" (redirecting to
`/login` immediately), check this allowlist first.

**Front-end connection:**
- Coach side: the "Student login" section inside
  `src/components/students/student-profile-dialog.tsx`, backed by
  `src/lib/actions/invites.ts` (`inviteStudent`).
- Student side: `src/app/invite/[token]/page.tsx` (shows the invite preview)
  and `src/app/invite/[token]/actions.ts` (`redeemInvite`, does the actual
  signup).
- After a successful signup, a student lands on `/student`
  (`src/app/student/page.tsx`) — today just a placeholder ("your account is
  set up") since the real student Dashboard/Calendar don't exist yet.

---

## 5. What a linked student can actually see and do (RLS)

A student account can:
- Read their **own** single row in `students` (not anyone else's).
- Read their **own** classes in `classes` — matched by which student record
  they're linked to, across **every coach**, not just one.
- **Book, edit, and delete their own classes and recurring series** — see
  section 8. This closes the gap noted in earlier revisions of this doc
  ("actual booking is future work") — it's now built.
- Read `class_series` rows where they're the student — needed so the
  student booking dialog can hydrate "whole series" edit fields, the
  student-side equivalent of `getClassSeriesMeta`.
- Read the shared `locations` roster, the club-wide coach directory
  (`profiles` where `role = 'coach'`), and every coach's materialized
  `coach_availability_blocks` — see sections 8-9.

A student account still **cannot** (unchanged from earlier phases):
- Edit their own `students` row (level, notes, racket type, etc. remain
  coach-write-only) — **except** the 6 stroke-strength rating columns, which
  are also coach-write-only, not student-editable either (see section 10).
- See `coach_availability_series` (the recurrence rules behind working-hours
  blocks) — only the materialized instances, mirroring how `class_series`
  itself stays hidden from the *coach* cross-visibility feature too.

**Front-end connection:** `src/app/student/page.tsx` (Student Home) and
`src/app/student/calendar/page.tsx` (Student Calendar) are the first real
consumers of all of this — previously nothing read these policies from the
frontend at all.

---

## 6. Cross-coach calendar visibility

A coach can now optionally see *other* coaches' booked classes and declared
working hours on their own Calendar — gated behind two independent toggles,
each opening a per-coach checklist (nothing shows by default beyond a
coach's own classes).

**The RLS change that makes this possible:** `classes`'s select policy was
changed from `coach_id = auth.uid()` to just `is_coach()` — any coach can now
*read* every class, club-wide. Insert/update/delete stay exactly as
coach-private as before (`is_coach() and coach_id = auth.uid()`), so a coach
can see but never edit another coach's booking. `class_series` was
deliberately left untouched (still fully coach-private) — no UI needs
another coach's recurrence rule, only the materialized instances, which
already carry `series_id`.

**Why two separate query functions exist for `classes`:** because the select
policy is now shared, `src/lib/queries/classes.ts` has both
`getAllClasses()` (explicitly filtered to `coach_id = <caller>`, used by the
Home dashboard and the Students page — pages that were never meant to show
cross-coach data) and `getAllClassesAllCoaches()` (unfiltered, used only by
the Calendar page). Relying on RLS alone here would have silently made Home
and Students cross-coach too — the explicit filter is a deliberate,
defense-in-depth choice, not a leftover.

**Coach display names:** `profiles` gained a `display_name` column
(populated from `auth.users.raw_user_meta_data->>'full_name'` at signup, via
the same `handle_new_user()` trigger from section 4), plus a new shared
select policy, `profiles_select_coach_directory`, letting any coach read the
roster of other coaches' names — needed to label events with whose they
are. Not exposed to students yet.

**Front-end connection:** `src/app/(app)/calendar/page.tsx` +
`src/components/calendar/class-calendar.tsx` — the toggle bar, per-coach
checklists, and color-coding (`src/lib/coach-colors.ts`) all live here.

## 7. Coach working hours (`coach_availability_series` / `coach_availability_blocks`)

A coach can declare when — and at which locations — they're generally
available to teach, from a new Settings page. This is purely descriptive:
there's no validation tying a class booking to a coach's declared hours, and
no exclusion constraint preventing a coach's own working-hours entries from
overlapping each other (e.g. a one-off adjustment layered over a standing
recurring block is valid, not an error).

**Structurally this is a direct mirror of `class_series`/`classes`:**
`coach_availability_series` holds the recurrence rule (Daily/Weekly/Monthly,
"every N", weekdays or day-of-month, a required `end_date` — same
`frequency_fields_consistent`-shaped CHECK constraint as `class_series`);
`coach_availability_blocks` holds the materialized instances, generated
entirely up front at creation time using the exact same
`generateOccurrences()` function from `src/lib/dates.ts` that class series
already use. `series_id` is null for one-off blocks. Editing "whole series"
regenerates only future (not-yet-started) blocks and leaves past ones alone,
identical in shape to `updateClassSeries`.

One difference from `class_series`: a working-hours entry can cover
**multiple locations at once** (`location_ids uuid[]`, at least one
required), so a coach can say "available at Court A or B, Mon–Wed 1–5pm" as
a single entry rather than one per court.

**RLS:** select is shared club-wide (`is_coach()`, no `coach_id` filter) on
both tables, same reasoning as classes above; insert/update/delete stay
scoped to `is_coach() and coach_id = auth.uid()`.

**Front-end connection:** `src/app/(app)/settings/page.tsx` (the coach's own
management view, via `getCoachAvailabilityBlocks()` — explicitly filtered to
`coach_id`, same defense-in-depth reasoning as section 6) and
`src/lib/actions/availability.ts` for create/update/delete. The Calendar
reads everyone's blocks via `getAllAvailabilityBlocks()` for its "Working
hours" toggle layer.

---

## 8. Student self-booking

A student can now book, edit, and delete their own classes — one-off or
recurring — with a coach of their choosing, immediately (no coach-approval
step), the same way a coach's own booking flow works.

**Why a parallel actions file instead of relaxing the existing one:**
`src/lib/actions/classes.ts` bakes in "the caller is a coach" at every level
— `coach_id` is always the caller's own id, `student_id` is whichever
student they pick, and every write is filtered `.eq("coach_id", coachId)`.
A student caller inverts that: `student_id` must be the caller (server-derived
from `requireStudent()`, **never** trusted from client input), and `coach_id`
is the client-chosen value. Rather than branching the existing functions on
caller role, `src/lib/actions/student-classes.ts` is a parallel file —
`createStudentClass`, `createStudentClassSeries`, `getStudentClassSeriesMeta`,
`updateStudentClassInstance`, `updateStudentClassSeries`,
`deleteStudentClassInstance`, `deleteStudentClassSeries` — whose writes/reads
filter by `.eq("student_id", studentId)` instead of `coach_id`, so a student
can act on **any** class or series where they're the student, including ones
a coach booked for them, matching the same "act on it regardless of who
created it" model the coach side already has for their own bookings.

**RLS:** new policies mirroring the existing coach-private shape but keyed
on `student_id` matching the caller's linked row —
`classes_insert_own_as_student` / `_update_own_as_student` /
`_delete_own_as_student`, and the equivalent four ops on `class_series`
(which had **zero** student policies before this — fully coach-private,
since no student-facing feature had ever needed it).

**A residual gap, mitigated at the app layer, not the DB:** `classes.coach_id`
only has a foreign key to `auth.users(id)` — it proves the id belongs to
*some* signed-up user, not specifically a coach. A crafted request could try
passing another student's id as `coachId`. `student-classes.ts`'s
`assertValidCoach()` helper checks `profiles.role = 'coach'` for the chosen
id before writing, closing that gap without a fragile cross-table CHECK
constraint.

**Front-end connection:** `src/components/calendar/student-class-edit-dialog.tsx`
(a fork of `class-edit-dialog.tsx` with a coach-picker instead of a
student-picker — the emitted payload shape inverts too, so making one
component generic over both was a bigger change than duplicating it) and
`src/components/calendar/student-calendar.tsx` / `src/components/
student-next-class-card.tsx` / `src/components/student-add-class-button.tsx`.

## 9. Student read access to coaches and working hours

Students can now read the shared `locations` roster, the coach directory
(`profiles` where `role = 'coach'`), and every coach's materialized
`coach_availability_blocks` — all club-wide, read-only. This is what powers
the coach-picker in the booking dialog and the Student Calendar's "Coaches'
working hours" toggle.

**Why `locations` needed a new policy at all:** it turned out `locations`
had **zero** student-select policy before this change (only
`locations_select_coach`, gated `is_coach()`) — a student calling the
roster query would have silently gotten nothing back. `locations_select_student`
(`is_student()`) closes that.

`coach_availability_blocks_select_student` and
`profiles_select_student_directory` mirror the equivalent coach-facing
policies from section 6/7. As with the coach cross-visibility feature,
`coach_availability_series` (the recurrence rules) is deliberately **not**
exposed to students — only the materialized blocks, which is all the
read-only toggle needs.

**Front-end connection:** `getLocationsForStudent()`, `getCoachesForStudent()`,
and `getAvailabilityBlocksForStudent()` in `src/lib/queries/*` — parallel,
`requireStudent()`-gated versions of the existing coach query functions,
following this codebase's established "own auth-check function per caller
role" convention rather than one function branching internally.

## 10. Coach-set stroke ratings

`students` gained 6 columns — `forehand_rating`, `backhand_rating`,
`backhand_slice_rating`, `volley_rating`, `serve_rating`, `drop_shot_rating`
— each a `smallint`, `0`-`100`, defaulting to `0`. These feed the Student
Home dashboard's radar chart.

**Why no RLS change was needed:** these are just new columns on an
already-coach-writable, already-student-readable table — the existing
`students_update_coach` (coach-only write) and `students_select_own_linked`
/ `students_select_coach` (read) policies already cover them.

**Front-end connection:** the coach edits these from the existing student
profile dialog (`src/components/students/student-profile-dialog.tsx`, six
new `Slider` controls), and the student sees them read-only via
`src/components/stroke-radar-chart.tsx` on their own Home dashboard.

---

## 11. Open Class

A class can be marked **Open** (with a capacity for extra joiners), letting
other students discover it and request to join. This is a **per-instance**
flag — `class_series` itself is untouched; a brand-new recurring series
always generates plain Closed instances, and opening one happens by editing
an individual generated instance afterward, exactly like any other
single-instance edit.

**Schema:** `classes` gained `is_open boolean default false` and
`max_joiners smallint` (CHECK: `null` unless open, `>0` if set — capacity is
**additional joiners only**, not counting the class's own student). A new
`class_participants` table holds approved joiners (`class_id`, `student_id`,
a denormalized `start_time`/`end_time` kept in sync by a trigger, `joined_at`,
`unique(class_id, student_id)`). A new `class_join_requests` table tracks a
student's request to join (`status: pending/approved/rejected`, a partial
unique index allowing exactly one *pending* request per student per class —
re-requesting after a rejection is allowed). A generic `notifications` table
(see section 12) carries the request/decision events.

**Why two tables, not one:** `classes.student_id` keeps meaning exactly what
it always has (the one host) — `classes_no_student_overlap` and
`classes_no_coach_overlap` (section 2's double-booking guarantees) needed
**zero changes**. `class_participants` gets its own, symmetric GiST exclusion
constraint (`class_participants_no_student_overlap`) so a joiner can't
double-book against another Open Class they've joined. `check_student_conflict`
(section 2) was extended with a second arm reading `class_participants`, so
the existing friendly pre-check also sees a student's joined-class
commitments, not just classes they host.

**The one accepted gap:** a joiner double-booking against a class they
personally *host* elsewhere is caught only by `decide_join_request`'s
app-level re-check at approval time, not a hard cross-table DB constraint — a
true guarantee there would need a materialized view/trigger scheme spanning
two tables, which isn't worth it for v1. This is a narrower, more honest gap
than earlier drafts of this doc suggested ("will require reworking both
double-booking exclusion constraints") — those constraints didn't need to
change at all.

**Who can browse and request:** a widened `classes` SELECT policy
(`classes_select_open_as_student`, additive to the existing own-classes
policy) lets any student read classes flagged `is_open = true` club-wide.
But a browsing student can't read another student's row via RLS at all
(`students_select_own_linked` is self-only), so seeing a useful pill needs
the host's name/level *before* any relationship exists between the two
students — that's what `get_open_classes_for_student()` (a narrow SECURITY
DEFINER function, same "expose only the display fields needed" pattern as
`get_invite_preview`) is for. `request_to_join_class(class_id)` (also
SECURITY DEFINER) resolves the caller's `student_id` server-side, validates
the class is open/not-own/not-already-joined-or-pending/has room, inserts the
request, and writes a `join_request_received` notification to the class's
coach — **only** the coach, not the host student, per the product decision
that a host only learns about a *decided* request, never a raw pending one.

**Deciding a request:** `decide_join_request(request_id, approve)` (SECURITY
DEFINER) is the only writer of `class_participants` and the only place a
request's status changes. It re-validates capacity and conflicts (time may
have passed since the request), and on approval: inserts the joiner, flips
`classes.class_type` to `'Group'` (reusing the existing enum value — no new
type needed), and writes `join_request_approved` (to the requester) and
`class_joined` (to the host) notifications. On rejection, only
`join_request_rejected` (to the requester) is written. The host notification
is skipped entirely if that student has no linked login yet (`auth_user_id`
is null) — inserting with a null `recipient_id` would otherwise fail the
whole approval, since `notifications.recipient_id` is `not null`.

**Reading a partner's profile for the Notifications UI:** two more narrow
SECURITY DEFINER functions exist for exactly this, since `students` SELECT
RLS still never lets one student read another's row directly (that table
carries email/age/gender/coaching notes peers shouldn't see): the existing
`get_class_partner_students(class_id)` (host sees every approved joiner, a
joiner sees the host — post-approval only) plus, added for the student
Notifications page specifically, `get_sent_join_requests_for_student()` /
`get_sent_join_request_detail(request_id)` (a requester's own view of the
host's card, at **any** status — pending/approved/rejected, unlike the
approval-gated function above) and `get_received_joins_for_student()` (a
host's list of who joined their classes — always approved, since that's the
only way a row exists).

**Front-end connection:** `src/components/calendar/recurrence-fields.tsx`'s
`OpenClassField` (the shared Open/Closed toggle + capacity input, reused by
both `class-edit-dialog.tsx` and `student-class-edit-dialog.tsx`);
`src/components/calendar/student-calendar.tsx`'s "Other students' Open
Classes" toggle and `open-class-view-dialog.tsx` (view + "Request to join");
`src/app/(app)/notifications/` (coach decision page) and
`src/app/student/notifications/` (student sent/received page), both under
`src/components/notifications/`.

## 12. Notifications

A generic in-app notification table, deliberately **not** a normalized/
typed-column design: `notifications(id, recipient_id, type text, payload
jsonb, read_at, created_at)`. The concrete reason a jsonb payload is
necessary, not just convenient — a *future* notification type (e.g. "this
class was edited/deleted") must be able to describe a row that may no longer
exist by the time it's rendered. A foreign-key-based design breaks exactly
there; a self-contained payload doesn't. `type` is plain `text`, not an enum
— adding a new notification type later needs no migration, just a new
string, a payload shape, and a UI branch. Valid values as of this feature:
`join_request_received`, `join_request_approved`, `join_request_rejected`,
`class_joined`.

**Write-only-via-function, same as `profiles`:** no insert/delete RLS policy
for `authenticated` at all — every row is written by one of the SECURITY
DEFINER functions in section 11, so a client can never forge a notification
"from" someone else or write into someone else's inbox. `read_at` gets a
plain client-side UPDATE policy scoped to `recipient_id = auth.uid()` (a
low-risk, self-only field — no need to route "mark as read" through an RPC).

**Role-agnostic by design:** `recipient_id` is just `auth.users.id`, and RLS
already scopes to "your own inbox" regardless of role — `getUnreadNotificationCount()`
and `markAllNotificationsRead()` in `src/lib/queries/notifications.ts` are
one shared implementation used by both the coach and student sidebars,
unlike most of this app's query layer, which forks per role.

**Delivery is fetch-on-load, not realtime:** no Supabase Realtime
subscriptions, no websockets. The unread badge (`NavItem`'s optional
`badgeCount` prop) and the notification lists are fetched when a page
renders or the user navigates — a deliberate v1 scope decision, and the app
had no realtime infrastructure to build on anyway.

**List content is a live query, not a `notifications` read:** the coach's
pending-requests list and the student's "sent requests" list both query
`class_join_requests` directly, not `notifications` rows — a request's
status can change after its notification was written, and the list should
always reflect current truth. `notifications` rows exist only to drive the
unread badge and announce the async "something happened" events; every
detail dialog re-fetches live data rather than trusting a payload snapshot.

**Front-end connection:** `src/components/nav-item.tsx` (badge rendering),
`src/components/sidebar.tsx` / `src/components/student-sidebar.tsx` (badge
wiring), `src/components/notifications/*` (lists, status icons, partner
cards, decision/detail dialogs), `src/lib/queries/notifications.ts`, and
`src/lib/actions/join-requests.ts`.

---

## Known gaps / deliberately deferred

These are documented so nobody re-discovers them as "surprises" later:

- **No automated invite emails.** A coach gets a link to copy/send manually.
- **One login can only ever link to one student record** — no support yet
  for a parent/guardian account managing multiple kids.
- **A student can't edit their own profile fields** (level, notes, stroke
  ratings, etc.) — all remain coach-write-only.
- **No coach-approval step for student self-booking.** A student's booking
  writes straight through, gated only by RLS and the same conflict checks a
  coach's own booking goes through — there's no pending/unconfirmed state.
- **A joiner double-booking against a class they personally host elsewhere
  is only an app-level check, not a hard DB guarantee** — see section 11.
  Same class of race-condition risk this codebase already accepts elsewhere
  (the exclusion-constraint backstop pattern), just not fully closed here
  since it's genuinely cross-table.
- **A coach can't open/set capacity on a class at series-creation time** —
  only per generated instance, after the fact. Opening a whole recurring
  series means editing each instance individually.
- **The in-app "notify" reminder dialog (`src/components/notify-dialog.tsx`)
  is still a manual UI nudge, not a real notification, for edit/delete
  actions** — unchanged by section 12's notification system, which only
  covers Open Class join requests/decisions so far. Extending real
  notifications to edit/delete is exactly the kind of future case section
  12's generic `type`/`payload` design was built to absorb without a new
  table.
- **Local dev note:** this Supabase project's default email settings (email
  confirmation + a low send-rate limit) can make the *public* signup/invite
  form reject or rate-limit test email addresses when testing repeatedly in
  a short window. This is a project configuration matter, not an app bug —
  when verifying signup-related work locally, prefer creating test accounts
  via `supabase.auth.admin.createUser(...)` (see `scripts/seed.ts` for the
  pattern) to bypass it, the same way our seed scripts already do.
