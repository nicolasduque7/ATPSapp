// Seeds ONE test coach with realistic demo data: locations, students,
// a handful of one-off classes, and a recurring series with its generated
// instances. Safe to re-run — it wipes and recreates this coach's data
// every time rather than accumulating duplicates.
//
// Usage: npm run seed
// Requires SUPABASE_SERVICE_ROLE_KEY in .env.local (Dashboard > Project
// Settings > API). The service role key bypasses RLS, which is what lets
// this script write on behalf of a coach without a real signed-in session.
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
import type {
  ClassType,
  CourtSurface,
  Gender,
  Hand,
  StudentLevel,
} from "../src/lib/mock-data";

const TEST_COACH_EMAIL = "coach@test.courtside.dev";
const TEST_COACH_PASSWORD = "CourtsideTest123!";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  throw new Error(
    "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY. " +
      "Add SUPABASE_SERVICE_ROLE_KEY to .env.local (Dashboard > Project Settings > API).",
  );
}

// This script wipes and recreates a coach's data — never let it run against
// the production project, even if .env.local gets pointed there by mistake.
const PROD_PROJECT_REF = "uyiqjrxmwjneaewsqznt";
if (SUPABASE_URL.includes(PROD_PROJECT_REF)) {
  throw new Error(
    `Refusing to seed: NEXT_PUBLIC_SUPABASE_URL points at the production project (${PROD_PROJECT_REF}). ` +
      "Point .env.local at the dev Supabase project before running this script.",
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
// (timezone-less) columns — see the migration's rationale. Postgres ignores
// any offset on a `timestamp without time zone` literal, so building these
// strings with Date's UTC getters/toISOString would silently shift every
// class by the machine's UTC offset. Local getters keep the wall-clock
// numbers the seed author intended.
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
      user_metadata: { full_name: "Alex Rivera" },
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

// Only this coach's own classes/series are wiped. Students and locations are
// shared club-wide (see PROJECT.md) — another coach's classes may already
// reference them, which makes their `on delete restrict` FK block a delete
// silently succeeding here. Re-creating them from scratch every run isn't
// even correct anymore now that they're shared: coach #2 depends on these
// exact rows persisting. `upsertByName` below reuses them instead.
//
// Working-hours rows are wiped and re-seeded too (not shared, coach-owned):
// without them, every class this script books would itself violate the
// working-hours enforcement now in place the moment it ships.
async function wipeCoachData(coachId: string): Promise<void> {
  await supabase.from("classes").delete().eq("coach_id", coachId);
  await supabase.from("class_series").delete().eq("coach_id", coachId);
  await supabase.from("coach_availability_series").delete().eq("coach_id", coachId);
  await supabase.from("coach_availability_blocks").delete().eq("coach_id", coachId);
}

// Reuses an existing shared row by name if one exists, otherwise inserts it.
async function upsertByName<T extends Record<string, unknown>>(
  table: "locations" | "students",
  name: string,
  insertRow: T,
): Promise<string> {
  const { data: existing, error: selectError } = await supabase
    .from(table)
    .select("id")
    .eq("name", name)
    .limit(1)
    .maybeSingle();
  if (selectError) throw selectError;
  if (existing) return existing.id as string;

  const { data: created, error: insertError } = await supabase
    .from(table)
    .insert(insertRow)
    .select("id")
    .single();
  if (insertError) throw insertError;
  return created.id as string;
}

interface LocationSeed {
  name: string;
  address: string;
  surface: CourtSurface;
  hardCourts: number;
  clayCourts: number;
}

const LOCATIONS: LocationSeed[] = [
  { name: "Riverside Courts", address: "100 Riverside Dr", surface: "Both", hardCourts: 3, clayCourts: 2 },
  { name: "Westside Park", address: "220 Westside Ave", surface: "Hard", hardCourts: 4, clayCourts: 0 },
  { name: "Oakwood Tennis Club", address: "44 Oakwood Ln", surface: "Clay", hardCourts: 0, clayCourts: 5 },
];

interface StudentSeed {
  name: string;
  nickname?: string;
  level: StudentLevel;
  age: number;
  gender: Gender;
  hand: Hand;
  racketType: string;
  since: Date;
  coachingNote?: string;
}

const STUDENTS: StudentSeed[] = [
  { name: "Ana Reyes", nickname: "Ani", level: "4ta", age: 14, gender: "Female", hand: "Right", racketType: "Wilson Clash 100", since: new Date(2023, 8, 1), coachingNote: "Focusing on topspin forehand consistency." },
  { name: "Leo Martins", nickname: "Leo", level: "6ta", age: 9, gender: "Male", hand: "Right", racketType: "Babolat Pure Drive Jr", since: new Date(2024, 5, 1) },
  { name: "Priya Nair", level: "1ra", age: 17, gender: "Female", hand: "Left", racketType: "Head Speed Pro", since: new Date(2021, 2, 1), coachingNote: "Preparing for regional qualifiers; serve placement drills." },
  { name: "Marcus Chen", nickname: "Marc", level: "4ta", age: 22, gender: "Male", hand: "Right", racketType: "Yonex Ezone 98", since: new Date(2022, 10, 1) },
  { name: "Sofia Petrov", level: "6ta", age: 11, gender: "Female", hand: "Right", racketType: "Wilson Roland Garros", since: new Date(2024, 0, 1) },
];

async function seed(): Promise<void> {
  const now = new Date();

  console.log(`Looking up or creating test coach (${TEST_COACH_EMAIL})...`);
  const coachId = await getOrCreateTestCoach();

  console.log("Wiping existing seed data for this coach...");
  await wipeCoachData(coachId);

  console.log("Looking up or creating locations (shared club-wide)...");
  const locationIds = new Map<string, string>();
  for (const l of LOCATIONS) {
    const id = await upsertByName("locations", l.name, {
      coach_id: coachId,
      name: l.name,
      address: l.address,
      surface: l.surface,
      hard_courts: l.hardCourts,
      clay_courts: l.clayCourts,
    });
    locationIds.set(l.name, id);
  }
  const locationId = (name: string) => {
    const id = locationIds.get(name);
    if (!id) throw new Error(`Seeded location "${name}" not found`);
    return id;
  };

  // Declares this coach as working 07:00-20:00 every day at all 3 shared
  // locations, comfortably covering every class this script books below
  // (earliest: dayOffset -3 at 09:00; latest: the monthly series' +120-day
  // window) — required now that bookings are validated against declared
  // working hours (see BACKEND.md section 7).
  console.log("Declaring working hours (07:00-20:00 daily, all locations)...");
  {
    const startDate = addDays(now, -30);
    const endDate = addDays(now, 130);
    const pattern: RecurrencePattern = { frequency: "Daily", intervalCount: 1 };
    const { data: availabilitySeries, error: availabilitySeriesError } = await supabase
      .from("coach_availability_series")
      .insert({
        coach_id: coachId,
        frequency: pattern.frequency,
        interval_count: pattern.intervalCount,
        location_ids: Array.from(locationIds.values()),
        start_time: "07:00:00",
        end_time: "20:00:00",
        start_date: localDate(startDate),
        end_date: localDate(endDate),
      })
      .select("id")
      .single();
    if (availabilitySeriesError) throw availabilitySeriesError;

    const availabilityBlockRows = generateOccurrences(pattern, startDate, endDate).map((day) => ({
      coach_id: coachId,
      series_id: availabilitySeries.id,
      location_ids: Array.from(locationIds.values()),
      start_time: localTimestamp(at(day, 0, 7, 0)),
      end_time: localTimestamp(at(day, 0, 20, 0)),
    }));
    const { error: availabilityBlocksError } = await supabase
      .from("coach_availability_blocks")
      .insert(availabilityBlockRows);
    if (availabilityBlocksError) throw availabilityBlocksError;
  }

  console.log("Looking up or creating students (shared club-wide)...");
  const studentIds = new Map<string, string>();
  for (const s of STUDENTS) {
    const id = await upsertByName("students", s.name, {
      coach_id: coachId,
      name: s.name,
      nickname: s.nickname ?? null,
      level: s.level,
      age: s.age,
      gender: s.gender,
      hand: s.hand,
      racket_type: s.racketType,
      since: localDate(s.since),
      coaching_note: s.coachingNote ?? null,
    });
    studentIds.set(s.name, id);
  }
  const studentId = (name: string) => {
    const id = studentIds.get(name);
    if (!id) throw new Error(`Seeded student "${name}" not found`);
    return id;
  };

  console.log("Inserting one-off classes...");
  interface OneOffSeed {
    dayOffset: number;
    hour: number;
    minute: number;
    durationMinutes: number;
    student: string;
    location: string;
    type: ClassType;
  }
  // dayOffset is relative to "today", so whichever entry lands on a Tuesday
  // (varies by run date) must not overlap the weekly recurring series below,
  // which is pinned to Tuesdays at 16:00-16:45 for the same coach — keep
  // every hour here clear of [16:00, 16:45) or classes_no_coach_overlap
  // will intermittently fail depending on what weekday the script runs on.
  const ONE_OFF_CLASSES: OneOffSeed[] = [
    // past (completed)
    { dayOffset: -3, hour: 9, minute: 0, durationMinutes: 60, student: "Marcus Chen", location: "Riverside Courts", type: "Private" },
    { dayOffset: -2, hour: 13, minute: 0, durationMinutes: 45, student: "Sofia Petrov", location: "Westside Park", type: "Group" },
    { dayOffset: -1, hour: 17, minute: 30, durationMinutes: 60, student: "Priya Nair", location: "Oakwood Tennis Club", type: "Match" },
    // today
    { dayOffset: 0, hour: 8, minute: 0, durationMinutes: 60, student: "Ana Reyes", location: "Riverside Courts", type: "Private" },
    { dayOffset: 0, hour: 18, minute: 0, durationMinutes: 60, student: "Marcus Chen", location: "Westside Park", type: "Private" },
    // upcoming
    { dayOffset: 1, hour: 9, minute: 30, durationMinutes: 45, student: "Leo Martins", location: "Westside Park", type: "Group" },
    { dayOffset: 2, hour: 11, minute: 0, durationMinutes: 60, student: "Sofia Petrov", location: "Oakwood Tennis Club", type: "Private" },
    { dayOffset: 4, hour: 10, minute: 0, durationMinutes: 60, student: "Priya Nair", location: "Riverside Courts", type: "Match" },
    { dayOffset: 6, hour: 15, minute: 0, durationMinutes: 60, student: "Ana Reyes", location: "Oakwood Tennis Club", type: "Private" },
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

  console.log("Inserting recurring series (Leo Martins, weekly Tuesday)...");
  const TUESDAY = 1; // 0 = Monday
  const weeklySeriesStart = addDays(mostRecentOrSameWeekday(now, TUESDAY), -21); // 3 weeks back
  const weeklySeriesEnd = addDays(weeklySeriesStart, 8 * 7); // 8 weeks after start = 9 total instances
  const weeklyInstanceCount = await insertSeries({
    student: "Leo Martins",
    location: "Westside Park",
    pattern: { frequency: "Weekly", intervalCount: 1, weekdays: [TUESDAY] },
    startDate: weeklySeriesStart,
    endDate: weeklySeriesEnd,
    hour: 16,
    minute: 0,
    durationMinutes: 45,
  });

  console.log("Inserting recurring series (Sofia Petrov, monthly on the 15th)...");
  const monthlySeriesStart = addDays(now, -60);
  const monthlySeriesEnd = addDays(now, 120);
  const monthlyInstanceCount = await insertSeries({
    student: "Sofia Petrov",
    location: "Oakwood Tennis Club",
    pattern: { frequency: "Monthly", intervalCount: 1, dayOfMonth: 15 },
    startDate: monthlySeriesStart,
    endDate: monthlySeriesEnd,
    hour: 17,
    minute: 0,
    durationMinutes: 60,
  });

  const recurringInstanceCount = weeklyInstanceCount + monthlyInstanceCount;

  console.log("\nSeed complete.");
  console.log(`  Coach:     ${TEST_COACH_EMAIL} / ${TEST_COACH_PASSWORD} (id: ${coachId})`);
  console.log(`  Locations: ${locationIds.size}`);
  console.log(`  Students:  ${studentIds.size}`);
  console.log(`  Classes:   ${oneOffRows.length} one-off + ${recurringInstanceCount} from recurring series`);
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
