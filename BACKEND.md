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

## 2. Preventing double-booking a student

**The problem:** a shared student could get booked by two different coaches
(or the same coach twice) at overlapping times, with nothing stopping it.

**The fix has two layers:**
1. **A hard rule inside the database** (an "exclusion constraint" on
   `classes`): Postgres itself refuses to store two rows for the same
   student with overlapping start/end times, no matter which coach or which
   code path tries to insert them. This is the real guarantee — it can't be
   bypassed by a bug in our app code.
2. **A friendly pre-check** (`check_student_conflict`, a database function):
   before saving, our server code asks "is this student free at this time?"
   and if not, shows a specific message naming the conflicting coach and
   time, instead of a raw database error. Because this needs to look across
   *every* coach's classes (not just the signed-in coach's), and normal
   queries can't see other coaches' rows, this function runs with a special
   "security definer" permission — narrowly scoped to answering just this
   one yes/no question, nothing else.

**Front-end connection:** `src/lib/actions/classes.ts` — every place a class
gets created or edited (`createClass`, `createClassSeries`,
`updateClassSeries`, `updateClassInstance`) calls this check first. If it
finds a conflict, the booking dialog (`src/components/calendar/
class-edit-dialog.tsx`) shows the message as ordinary red form-error text —
no special UI was needed, since that error-display plumbing already existed.

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

## 5. What a linked student can actually see (RLS)

A student account can:
- Read their **own** single row in `students` (not anyone else's).
- Read their **own** classes in `classes` — matched by which student record
  they're linked to, across **every coach** (not just one), since that's
  what a future "see my whole schedule" feature needs.

A student account **cannot** (in this phase):
- Write to `students`, `locations`, `classes`, or `class_series` at all —
  no editing their own profile, no booking, nothing yet. That's intentional
  — this phase only had to prove login + linking + read access work safely;
  actual booking is future work (see below).
- See `class_series` (the recurrence rules) — they only see individual
  class instances, which is all a student needs.

**Front-end connection:** nothing yet reads these student-facing policies
from the frontend — there's no student Dashboard or Calendar built. This is
groundwork for that future work, verified directly against the database.

---

## Known gaps / deliberately deferred

These are documented so nobody re-discovers them as "surprises" later:

- **No student Dashboard or Calendar UI yet.** `/student` is a placeholder.
- **No cross-coach calendar visibility for coaches**, even though the
  student-read policy above already supports it under the hood. A coach
  still only ever sees their own booked classes.
- **"Open Class" (letting other students join a class) isn't built.**
  `classes` today is strictly one row per student — there's no table for
  "multiple students in one class" yet. Building it will also require
  reworking the double-booking exclusion constraint (section 2), since that
  constraint currently assumes exactly one student per class row.
- **No automated invite emails.** A coach gets a link to copy/send manually.
- **One login can only ever link to one student record** — no support yet
  for a parent/guardian account managing multiple kids.
- **A student can't edit their own profile fields** (level, notes, etc.) —
  read-only for now.
- **Local dev note:** this Supabase project's default email settings (email
  confirmation + a low send-rate limit) can make the *public* signup/invite
  form reject or rate-limit test email addresses when testing repeatedly in
  a short window. This is a project configuration matter, not an app bug —
  when verifying signup-related work locally, prefer creating test accounts
  via `supabase.auth.admin.createUser(...)` (see `scripts/seed.ts` for the
  pattern) to bypass it, the same way our seed scripts already do.
