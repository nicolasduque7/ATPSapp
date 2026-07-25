import { requireCoachId, requireStudent } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { toLocalTimestamp } from "@/lib/dates";
import type { ClassInstance } from "@/lib/mock-data";
import { mapClassRow, CLASS_COLUMNS } from "@/lib/queries/class-row";

export async function getUpcomingClasses(): Promise<ClassInstance[]> {
  const coachId = await requireCoachId();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("classes")
    .select(CLASS_COLUMNS)
    .eq("coach_id", coachId)
    .gte("start_time", toLocalTimestamp(new Date()))
    .order("start_time");

  if (error) {
    console.error("getUpcomingClasses failed:", error);
    throw new Error("Couldn't load classes. Try again.");
  }

  // Every row matched start_time >= now, so none of these can be completed.
  return (data ?? []).map((row) => mapClassRow(row, false));
}

// Own classes only, filtered explicitly rather than relying solely on RLS —
// `classes` select is now shared club-wide (see the cross-coach visibility
// migration), so callers that want just "my schedule" (e.g. the Home
// dashboard) need this, not `getAllClassesAllCoaches`.
export async function getAllClasses(): Promise<ClassInstance[]> {
  const coachId = await requireCoachId();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("classes")
    .select(CLASS_COLUMNS)
    .eq("coach_id", coachId)
    .order("start_time");

  if (error) {
    console.error("getAllClasses failed:", error);
    throw new Error("Couldn't load classes. Try again.");
  }

  const now = new Date();
  return (data ?? []).map((row) => mapClassRow(row, new Date(row.end_time) < now));
}

// A student's own classes, across every coach — explicitly filtered rather
// than relying solely on RLS, matching this file's established
// defense-in-depth convention (see getAllClasses above).
export async function getStudentClasses(): Promise<ClassInstance[]> {
  const { studentId } = await requireStudent();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("classes")
    .select(CLASS_COLUMNS)
    .eq("student_id", studentId)
    .order("start_time");

  if (error) {
    console.error("getStudentClasses failed:", error);
    throw new Error("Couldn't load classes. Try again.");
  }

  const now = new Date();
  return (data ?? []).map((row) => mapClassRow(row, new Date(row.end_time) < now));
}

// Every coach's classes club-wide, for the Calendar's cross-coach visibility
// toggle. Relies on the shared `classes_select_coach` RLS policy — writes
// remain coach-private regardless of what this returns.
export async function getAllClassesAllCoaches(): Promise<ClassInstance[]> {
  await requireCoachId();
  const supabase = await createClient();

  const { data, error } = await supabase.from("classes").select(CLASS_COLUMNS).order("start_time");

  if (error) {
    console.error("getAllClassesAllCoaches failed:", error);
    throw new Error("Couldn't load classes. Try again.");
  }

  const now = new Date();
  return (data ?? []).map((row) => mapClassRow(row, new Date(row.end_time) < now));
}
