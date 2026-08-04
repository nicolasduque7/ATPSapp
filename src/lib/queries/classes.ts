import { requireCoachId, requireStudent } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatDbTimestamp, parseDbTimestamp } from "@/lib/dates";
import type { ClassInstance, ClassType, StudentLevel } from "@/lib/mock-data";
import { mapClassRow, CLASS_COLUMNS } from "@/lib/queries/class-row";
import { getParticipantsByClassId } from "@/lib/actions/class-shared";

export async function getUpcomingClasses(): Promise<ClassInstance[]> {
  const coachId = await requireCoachId();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("classes")
    .select(CLASS_COLUMNS)
    .eq("coach_id", coachId)
    .gte("start_time", formatDbTimestamp(new Date()))
    .order("start_time");

  if (error) {
    console.error("getUpcomingClasses failed:", error);
    throw new Error("Couldn't load classes. Try again.");
  }

  const rosterByClassId = await getParticipantsByClassId(
    supabase,
    (data ?? []).map((row) => row.id),
  );
  // Every row matched start_time >= now, so none of these can be completed.
  return (data ?? []).map((row) => mapClassRow(row, false, rosterByClassId.get(row.id) ?? []));
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

  const rosterByClassId = await getParticipantsByClassId(
    supabase,
    (data ?? []).map((row) => row.id),
  );
  const now = new Date();
  return (data ?? []).map((row) =>
    mapClassRow(row, parseDbTimestamp(row.end_time) < now, rosterByClassId.get(row.id) ?? []),
  );
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

  const rosterByClassId = await getParticipantsByClassId(
    supabase,
    (data ?? []).map((row) => row.id),
  );
  const now = new Date();
  return (data ?? []).map((row) =>
    mapClassRow(row, parseDbTimestamp(row.end_time) < now, rosterByClassId.get(row.id) ?? []),
  );
}

export interface OpenClassForStudent {
  classId: string;
  coachId: string;
  coachName: string;
  locationId: string;
  startTime: Date;
  endTime: Date;
  durationMinutes: number;
  type: ClassType;
  hostStudentId: string;
  hostStudentName: string;
  hostStudentLevel: StudentLevel;
  maxJoiners: number | null;
}

interface OpenClassForStudentRow {
  class_id: string;
  coach_id: string;
  coach_name: string;
  location_id: string;
  start_time: string;
  end_time: string;
  duration_minutes: number;
  class_type: ClassType;
  host_student_id: string;
  host_student_name: string;
  host_student_level: StudentLevel;
  max_joiners: number | null;
}

// Other students' Open Classes, for the student Calendar's toggle. Routed
// through a SECURITY DEFINER RPC (not a plain classes select) because
// rendering a useful pill/preview needs the host student's name and level —
// students table RLS only ever lets a student read their OWN row, so a plain
// query can see that a class is open but not who's on it.
export async function getOpenClassesForStudent(): Promise<OpenClassForStudent[]> {
  const { studentId } = await requireStudent();
  const supabase = await createClient();

  const { data, error } = await supabase.rpc("get_open_classes_for_student");

  if (error) {
    console.error("getOpenClassesForStudent failed:", error);
    throw new Error("Couldn't load open classes. Try again.");
  }

  // Defense-in-depth, matching this file's established convention: exclude
  // the caller's own hosted classes explicitly rather than relying solely on
  // the RPC (which already only returns is_open rows, but doesn't exclude
  // "my own").
  return ((data as OpenClassForStudentRow[]) ?? [])
    .filter((row) => row.host_student_id !== studentId)
    .map((row) => ({
      classId: row.class_id,
      coachId: row.coach_id,
      coachName: row.coach_name,
      locationId: row.location_id,
      startTime: parseDbTimestamp(row.start_time),
      endTime: parseDbTimestamp(row.end_time),
      durationMinutes: row.duration_minutes,
      type: row.class_type,
      hostStudentId: row.host_student_id,
      hostStudentName: row.host_student_name,
      hostStudentLevel: row.host_student_level,
      maxJoiners: row.max_joiners,
    }));
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

  const rosterByClassId = await getParticipantsByClassId(
    supabase,
    (data ?? []).map((row) => row.id),
  );
  const now = new Date();
  return (data ?? []).map((row) =>
    mapClassRow(row, parseDbTimestamp(row.end_time) < now, rosterByClassId.get(row.id) ?? []),
  );
}
