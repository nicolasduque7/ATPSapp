// Seeds a SECOND test coach with their own one-off classes and a recurring
// series, booked against the SAME shared students/locations that `seed.ts`
// creates for coach #1 (students and locations are shared club-wide — see
// PROJECT.md). Run `npm run seed` first so those shared rows exist.
//
// A DB-level exclusion constraint now blocks overlapping bookings for the
// same student across coaches, so class times here are deliberately kept
// close to (but never overlapping) coach #1's classes for the same shared
// student, as a reminder of that boundary.
//
// Only this coach's classes/class_series are wiped on re-run — shared
// students/locations are looked up, never inserted or deleted here.
//
// Usage: npm run seed:coach2
// Requires SUPABASE_SERVICE_ROLE_KEY in .env.local (same as seed.ts).
import { createClient } from "@supabase/supabase-js";
import WebSocket from "ws";
import {
  addDays,
  addMinutes,
  formatDateOnly as localDate,
  generateOccurrences,
  combineClubDateAndTime,
  formatDbTimestamp as localTimestamp,
  type RecurrencePattern,
} from "../src/lib/dates";
import type { ClassType } from "../src/lib/mock-data";

const TEST_COACH_EMAIL = "coach2@test.courtside.dev";
const TEST_COACH_PASSWORD = "CourtsideTest123!";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  throw new Error(
    "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY. " +
      "Add SUPABASE_SERVICE_ROLE_KEY to .env.local (Dashboard > Project Settings > API).",
  );
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
  // Node 20 has no global WebSocket (that lands in Node 22); supabase-js
  // still wires up a realtime client on construction even though this
  // script never uses it, so it needs an explicit transport to not throw.
  realtime: { transport: WebSocket as unknown as typeof globalThis.WebSocket },
});

// `classes.start_time`/`end_time` and `class_series.start_time` are plain
// (timezone-less) columns. Local getters (not UTC/ISO) keep the wall-clock
// numbers the seed author intended — see seed.ts for the full rationale.
function pad(n: number): string {
  return n.toString().padStart(2, "0");
}

function at(base: Date, dayOffset: number, hour: number, minute: number): Date {
  const day = new Date(base);
  day.setDate(day.getDate() + dayOffset);
  return combineClubDateAndTime(day, `${pad(hour)}:${pad(minute)}`);
}

// 0 = Monday .. 6 = Sunday, matching class_series.weekdays' convention.
function mostRecentOrSameWeekday(from: Date, weekday: number): Date {
  const fromWeekday = (from.getDay() + 6) % 7;
  const diff = (fromWeekday - weekday + 7) % 7;
  return addDays(from, -diff);
}

async function getOrCreateTestCoach(): Promise<string> {
  const { data: created, error: createError } =
    await supabase.auth.admin.createUser({
      email: TEST_COACH_EMAIL,
      password: TEST_COACH_PASSWORD,
      email_confirm: true,
      user_metadata: { full_name: "Jordan Blake" },
    });

  if (!createError) {
    return created.user.id;
  }

  if (createError.code !== "email_exists") {
    throw createError;
  }

  const { data: list, error: listError } = await supabase.auth.admin.listUsers({
    perPage: 200,
  });
  if (listError) throw listError;

  const existing = list.users.find((u) => u.email === TEST_COACH_EMAIL);
  if (!existing) {
    throw new Error(
      `Coach creation reported "email_exists" but no user with ${TEST_COACH_EMAIL} was found.`,
    );
  }
  return existing.id;
}

async function wipeCoachClasses(coachId: string): Promise<void> {
  // Only this coach's classes/series — students and locations are shared
  // club-wide and are never inserted or wiped by this script.
  await supabase.from("classes").delete().eq("coach_id", coachId);
  await supabase.from("class_series").delete().eq("coach_id", coachId);
}

async function loadSharedLookups(): Promise<{
  locationId: (name: string) => string;
  studentId: (name: string) => string;
}> {
  const { data: locations, error: locationsError } = await supabase
    .from("locations")
    .select("id, name");
  if (locationsError) throw locationsError;

  const { data: students, error: studentsError } = await supabase
    .from("students")
    .select("id, name");
  if (studentsError) throw studentsError;

  const locationId = (name: string) => {
    const match = locations.find((l) => l.name === name);
    if (!match) {
      throw new Error(
        `Shared location "${name}" not found — run "npm run seed" first to create it.`,
      );
    }
    return match.id as string;
  };
  const studentId = (name: string) => {
    const match = students.find((s) => s.name === name);
    if (!match) {
      throw new Error(
        `Shared student "${name}" not found — run "npm run seed" first to create it.`,
      );
    }
    return match.id as string;
  };

  return { locationId, studentId };
}

async function seed(): Promise<void> {
  console.log(`Looking up or creating test coach #2 (${TEST_COACH_EMAIL})...`);
  const coachId = await getOrCreateTestCoach();

  console.log("Wiping existing classes/series for this coach...");
  await wipeCoachClasses(coachId);

  console.log("Looking up shared students/locations (seeded by coach #1)...");
  const { locationId, studentId } = await loadSharedLookups();

  console.log("Inserting one-off classes...");
  const now = new Date();
  interface OneOffSeed {
    dayOffset: number;
    hour: number;
    minute: number;
    durationMinutes: number;
    student: string;
    location: string;
    type: ClassType;
  }
  const ONE_OFF_CLASSES: OneOffSeed[] = [
    // past (completed)
    { dayOffset: -4, hour: 10, minute: 0, durationMinutes: 60, student: "Leo Martins", location: "Oakwood Tennis Club", type: "Group" },
    { dayOffset: -1, hour: 9, minute: 0, durationMinutes: 60, student: "Marcus Chen", location: "Riverside Courts", type: "Private" },
    // today — back-to-back (not overlapping) with coach #1's 08:00-09:00
    // Ana Reyes class at Riverside Courts.
    { dayOffset: 0, hour: 9, minute: 15, durationMinutes: 60, student: "Ana Reyes", location: "Westside Park", type: "Private" },
    { dayOffset: 0, hour: 19, minute: 0, durationMinutes: 60, student: "Priya Nair", location: "Riverside Courts", type: "Match" },
    // upcoming
    { dayOffset: 1, hour: 14, minute: 0, durationMinutes: 60, student: "Sofia Petrov", location: "Riverside Courts", type: "Private" },
    { dayOffset: 3, hour: 16, minute: 0, durationMinutes: 45, student: "Leo Martins", location: "Westside Park", type: "Group" },
    // back-to-back (not overlapping) with coach #1's 10:00-11:00 Priya Nair
    // match at Riverside Courts (dayOffset 4) — same student, different coach.
    { dayOffset: 4, hour: 11, minute: 15, durationMinutes: 60, student: "Priya Nair", location: "Oakwood Tennis Club", type: "Match" },
    { dayOffset: 6, hour: 11, minute: 0, durationMinutes: 60, student: "Marcus Chen", location: "Oakwood Tennis Club", type: "Private" },
  ];

  const oneOffRows = ONE_OFF_CLASSES.map((c) => {
    const startTime = at(now, c.dayOffset, c.hour, c.minute);
    const endTime = addMinutes(startTime, c.durationMinutes);
    return {
      coach_id: coachId,
      student_id: studentId(c.student),
      location_id: locationId(c.location),
      class_type: c.type,
      start_time: localTimestamp(startTime),
      end_time: localTimestamp(endTime),
      duration_minutes: c.durationMinutes,
    };
  });
  const { error: oneOffError } = await supabase.from("classes").insert(oneOffRows);
  if (oneOffError) throw oneOffError;

  async function insertSeries(options: {
    student: string;
    location: string;
    pattern: RecurrencePattern;
    startDate: Date;
    endDate: Date;
    hour: number;
    minute: number;
    durationMinutes: number;
  }): Promise<number> {
    const { student, location, pattern, startDate, endDate, hour, minute, durationMinutes } = options;

    const { data: seriesRow, error: seriesError } = await supabase
      .from("class_series")
      .insert({
        coach_id: coachId,
        student_id: studentId(student),
        location_id: locationId(location),
        class_type: "Private",
        frequency: pattern.frequency,
        interval_count: pattern.intervalCount,
        weekdays: pattern.weekdays ?? null,
        day_of_month: pattern.dayOfMonth ?? null,
        start_time: `${pad(hour)}:${pad(minute)}:00`,
        duration_minutes: durationMinutes,
        start_date: localDate(startDate),
        end_date: localDate(endDate),
      })
      .select("id")
      .single();
    if (seriesError) throw seriesError;

    const occurrences = generateOccurrences(pattern, startDate, endDate);
    const instanceRows = occurrences.map((day) => {
      const startTime = at(day, 0, hour, minute);
      const endTime = addMinutes(startTime, durationMinutes);
      return {
        coach_id: coachId,
        student_id: studentId(student),
        location_id: locationId(location),
        series_id: seriesRow.id,
        class_type: "Private" as ClassType,
        start_time: localTimestamp(startTime),
        end_time: localTimestamp(endTime),
        duration_minutes: durationMinutes,
      };
    });
    const { error: instancesError } = await supabase.from("classes").insert(instanceRows);
    if (instancesError) throw instancesError;

    return instanceRows.length;
  }

  console.log("Inserting recurring series (Ana Reyes, weekly Thursday)...");
  const THURSDAY = 3; // 0 = Monday
  const weeklySeriesStart = addDays(mostRecentOrSameWeekday(now, THURSDAY), -14); // 2 weeks back
  const weeklySeriesEnd = addDays(weeklySeriesStart, 8 * 7); // 8 weeks after start
  const weeklyInstanceCount = await insertSeries({
    student: "Ana Reyes",
    location: "Oakwood Tennis Club",
    pattern: { frequency: "Weekly", intervalCount: 1, weekdays: [THURSDAY] },
    startDate: weeklySeriesStart,
    endDate: weeklySeriesEnd,
    hour: 18,
    minute: 0,
    durationMinutes: 60,
  });

  console.log("Inserting recurring series (Marcus Chen, monthly on the 5th)...");
  const monthlySeriesStart = addDays(now, -45);
  const monthlySeriesEnd = addDays(now, 135);
  const monthlyInstanceCount = await insertSeries({
    student: "Marcus Chen",
    location: "Westside Park",
    pattern: { frequency: "Monthly", intervalCount: 1, dayOfMonth: 5 },
    startDate: monthlySeriesStart,
    endDate: monthlySeriesEnd,
    hour: 9,
    minute: 0,
    durationMinutes: 60,
  });

  const recurringInstanceCount = weeklyInstanceCount + monthlyInstanceCount;

  console.log("\nSeed complete.");
  console.log(`  Coach:     ${TEST_COACH_EMAIL} / ${TEST_COACH_PASSWORD} (id: ${coachId})`);
  console.log(`  Classes:   ${oneOffRows.length} one-off + ${recurringInstanceCount} from recurring series`);
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
