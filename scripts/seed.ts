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

function localDate(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function localTimestamp(d: Date): string {
  return `${localDate(d)}T${pad(d.getHours())}:${pad(d.getMinutes())}:00`;
}

function localTime(d: Date): string {
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:00`;
}

function at(base: Date, dayOffset: number, hour: number, minute: number): Date {
  const d = new Date(base);
  d.setDate(d.getDate() + dayOffset);
  d.setHours(hour, minute, 0, 0);
  return d;
}

function addMinutes(d: Date, minutes: number): Date {
  return new Date(d.getTime() + minutes * 60_000);
}

function addDays(d: Date, days: number): Date {
  const copy = new Date(d);
  copy.setDate(copy.getDate() + days);
  return copy;
}

// 0 = Monday .. 6 = Sunday, matching the `class_series.weekday` check constraint.
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

async function wipeCoachData(coachId: string): Promise<void> {
  // Order matters: classes reference students/locations/series, so they go
  // first, then the series they may belong to, then students/locations.
  await supabase.from("classes").delete().eq("coach_id", coachId);
  await supabase.from("class_series").delete().eq("coach_id", coachId);
  await supabase.from("students").delete().eq("coach_id", coachId);
  await supabase.from("locations").delete().eq("coach_id", coachId);
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
  console.log(`Looking up or creating test coach (${TEST_COACH_EMAIL})...`);
  const coachId = await getOrCreateTestCoach();

  console.log("Wiping existing seed data for this coach...");
  await wipeCoachData(coachId);

  console.log("Inserting locations...");
  const { data: locations, error: locationsError } = await supabase
    .from("locations")
    .insert(
      LOCATIONS.map((l) => ({
        coach_id: coachId,
        name: l.name,
        address: l.address,
        surface: l.surface,
        hard_courts: l.hardCourts,
        clay_courts: l.clayCourts,
      })),
    )
    .select("id, name");
  if (locationsError) throw locationsError;
  const locationId = (name: string) => {
    const match = locations.find((l) => l.name === name);
    if (!match) throw new Error(`Seeded location "${name}" not found`);
    return match.id as string;
  };

  console.log("Inserting students...");
  const { data: students, error: studentsError } = await supabase
    .from("students")
    .insert(
      STUDENTS.map((s) => ({
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
      })),
    )
    .select("id, name");
  if (studentsError) throw studentsError;
  const studentId = (name: string) => {
    const match = students.find((s) => s.name === name);
    if (!match) throw new Error(`Seeded student "${name}" not found`);
    return match.id as string;
  };

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
    { dayOffset: -3, hour: 9, minute: 0, durationMinutes: 60, student: "Marcus Chen", location: "Riverside Courts", type: "Private" },
    { dayOffset: -2, hour: 16, minute: 0, durationMinutes: 45, student: "Sofia Petrov", location: "Westside Park", type: "Group" },
    { dayOffset: -1, hour: 17, minute: 30, durationMinutes: 60, student: "Priya Nair", location: "Oakwood Tennis Club", type: "Match" },
    // today
    { dayOffset: 0, hour: 8, minute: 0, durationMinutes: 60, student: "Ana Reyes", location: "Riverside Courts", type: "Private" },
    { dayOffset: 0, hour: 18, minute: 0, durationMinutes: 60, student: "Marcus Chen", location: "Westside Park", type: "Private" },
    // upcoming
    { dayOffset: 1, hour: 9, minute: 30, durationMinutes: 45, student: "Leo Martins", location: "Westside Park", type: "Group" },
    { dayOffset: 2, hour: 16, minute: 0, durationMinutes: 60, student: "Sofia Petrov", location: "Oakwood Tennis Club", type: "Private" },
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

  console.log("Inserting recurring series (Leo Martins, weekly Tuesday)...");
  const TUESDAY = 1; // 0 = Monday
  const seriesStart = addDays(mostRecentOrSameWeekday(now, TUESDAY), -21); // 3 weeks back
  const seriesEnd = addDays(seriesStart, 8 * 7); // 8 weeks after start = 9 total instances
  const seriesHour = 16;
  const seriesMinute = 0;
  const seriesDuration = 45;

  const { data: series, error: seriesError } = await supabase
    .from("class_series")
    .insert({
      coach_id: coachId,
      student_id: studentId("Leo Martins"),
      location_id: locationId("Westside Park"),
      class_type: "Private",
      weekday: TUESDAY,
      start_time: localTime(at(seriesStart, 0, seriesHour, seriesMinute)),
      duration_minutes: seriesDuration,
      start_date: localDate(seriesStart),
      end_date: localDate(seriesEnd),
    })
    .select("id")
    .single();
  if (seriesError) throw seriesError;

  const instanceRows = [];
  for (let d = new Date(seriesStart); d <= seriesEnd; d = addDays(d, 7)) {
    const startTime = at(d, 0, seriesHour, seriesMinute);
    const endTime = addMinutes(startTime, seriesDuration);
    instanceRows.push({
      coach_id: coachId,
      student_id: studentId("Leo Martins"),
      location_id: locationId("Westside Park"),
      series_id: series.id,
      class_type: "Private" as ClassType,
      start_time: localTimestamp(startTime),
      end_time: localTimestamp(endTime),
      duration_minutes: seriesDuration,
    });
  }
  const { error: instancesError } = await supabase.from("classes").insert(instanceRows);
  if (instancesError) throw instancesError;

  console.log("\nSeed complete.");
  console.log(`  Coach:     ${TEST_COACH_EMAIL} / ${TEST_COACH_PASSWORD} (id: ${coachId})`);
  console.log(`  Locations: ${locations.length}`);
  console.log(`  Students:  ${students.length}`);
  console.log(`  Classes:   ${oneOffRows.length} one-off + ${instanceRows.length} from recurring series`);
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
