// Seeds ONE test STUDENT login, linked to a dedicated `students` row, for
// e2e coverage of the student-facing app (booking, calendar, notifications).
// Bypasses the real invite-link redemption flow entirely (that's a client
// signup path, not something a service-role script needs to replay) — a
// fresh auth user always gets a `profiles.role = 'coach'` row from
// `handle_new_user()` when no invite_token is present (see
// 20260724020000_student_auth_foundation.sql), so this script flips that
// role to 'student' and links a dedicated student record directly,
// mirroring what a real invite redemption would have produced.
//
// Run `npm run seed` first so the shared coach this student's record is
// attributed to (coach_id is just an audit field — see PROJECT.md) exists.
//
// Usage: npm run seed:student
// Requires SUPABASE_SERVICE_ROLE_KEY in .env.local (same as seed.ts).
import { createClient } from "@supabase/supabase-js";
import WebSocket from "ws";

const TEST_COACH_EMAIL = "coach@test.courtside.dev";
export const TEST_STUDENT_EMAIL = "student@test.courtside.dev";
export const TEST_STUDENT_PASSWORD = "CourtsideTest123!";
const TEST_STUDENT_NAME = "Test Student";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  throw new Error(
    "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY. " +
      "Add SUPABASE_SERVICE_ROLE_KEY to .env.local (Dashboard > Project Settings > API).",
  );
}

// This script writes auth users and profile/role rows directly — never let
// it run against the production project, even if .env.local gets pointed
// there by mistake.
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

async function getOrCreateTestCoachId(): Promise<string> {
  const { data: list, error: listError } = await supabase.auth.admin.listUsers({ perPage: 200 });
  if (listError) throw listError;

  const existing = list.users.find((u) => u.email === TEST_COACH_EMAIL);
  if (!existing) {
    throw new Error(`Test coach (${TEST_COACH_EMAIL}) not found — run "npm run seed" first.`);
  }
  return existing.id;
}

async function getOrCreateTestStudentAuthUser(): Promise<string> {
  const { data: created, error: createError } = await supabase.auth.admin.createUser({
    email: TEST_STUDENT_EMAIL,
    password: TEST_STUDENT_PASSWORD,
    email_confirm: true,
    user_metadata: { full_name: TEST_STUDENT_NAME },
  });

  if (!createError) {
    return created.user.id;
  }

  if (createError.code !== "email_exists") {
    throw createError;
  }

  const { data: list, error: listError } = await supabase.auth.admin.listUsers({ perPage: 200 });
  if (listError) throw listError;

  const existing = list.users.find((u) => u.email === TEST_STUDENT_EMAIL);
  if (!existing) {
    throw new Error(
      `Student creation reported "email_exists" but no user with ${TEST_STUDENT_EMAIL} was found.`,
    );
  }
  return existing.id;
}

async function seed(): Promise<void> {
  console.log("Looking up test coach (for the student record's audit coach_id)...");
  const coachId = await getOrCreateTestCoachId();

  console.log(`Looking up or creating test student login (${TEST_STUDENT_EMAIL})...`);
  const authUserId = await getOrCreateTestStudentAuthUser();

  console.log("Ensuring profiles.role = 'student'...");
  const { error: profileError } = await supabase
    .from("profiles")
    .update({ role: "student" })
    .eq("id", authUserId);
  if (profileError) throw profileError;

  console.log("Linking a dedicated students row...");
  const { data: existingStudent, error: findError } = await supabase
    .from("students")
    .select("id")
    .eq("auth_user_id", authUserId)
    .maybeSingle();
  if (findError) throw findError;

  if (existingStudent) {
    console.log(`Already linked (student id: ${existingStudent.id}).`);
  } else {
    const { data: inserted, error: insertError } = await supabase
      .from("students")
      .insert({
        coach_id: coachId,
        auth_user_id: authUserId,
        name: TEST_STUDENT_NAME,
        email: TEST_STUDENT_EMAIL,
        level: "4ta",
        age: 20,
        gender: "Female",
        hand: "Right",
        racket_type: "Wilson Clash 100",
      })
      .select("id")
      .single();
    if (insertError) throw insertError;
    console.log(`Created and linked (student id: ${inserted.id}).`);
  }

  console.log("\nSeed complete.");
  console.log(`  Student:   ${TEST_STUDENT_EMAIL} / ${TEST_STUDENT_PASSWORD} (auth id: ${authUserId})`);
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
