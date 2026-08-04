import { requireCoachId, requireStudent } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { Student, StudentLevel } from "@/lib/mock-data";
import { mapStudentRow, STUDENT_COLUMNS } from "@/lib/queries/student-row";

export async function getStudents(): Promise<Student[]> {
  await requireCoachId();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("students")
    .select(STUDENT_COLUMNS)
    .order("name");

  if (error) {
    console.error("getStudents failed:", error);
    throw new Error("Couldn't load students. Try again.");
  }

  return (data ?? []).map(mapStudentRow);
}

// The signed-in student's own roster row — feeds the radar chart's stroke
// ratings, and satisfies mapClassInstanceToEvent's `students: Student[]`
// param as `[profile]` with no changes to that shared mapper.
export async function getCurrentStudentProfile(): Promise<Student> {
  const { studentId } = await requireStudent();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("students")
    .select(STUDENT_COLUMNS)
    .eq("id", studentId)
    .single();

  if (error) {
    console.error("getCurrentStudentProfile failed:", error);
    throw new Error("Couldn't load your profile. Try again.");
  }

  return mapStudentRow(data);
}

// Display-fields-only shape for the "add classmates" picker — a student
// can't read a peer's full row via RLS, so this is intentionally narrower
// than Student (no email/age/gender/coaching notes).
export interface AddableStudent {
  id: string;
  name: string;
  nickname?: string;
  level: StudentLevel;
}

interface AddableStudentRow {
  id: string;
  name: string;
  nickname: string | null;
  level: StudentLevel;
}

// Classmates a student can pick for a Group/Match class, routed through a
// SECURITY DEFINER RPC for the same reason getOpenClassesForStudent is —
// students_select_own_linked only ever lets a student read their own row.
export async function getAddableStudentsForStudent(): Promise<AddableStudent[]> {
  await requireStudent();
  const supabase = await createClient();

  const { data, error } = await supabase.rpc("get_addable_students");

  if (error) {
    console.error("getAddableStudentsForStudent failed:", error);
    throw new Error("Couldn't load classmates. Try again.");
  }

  return ((data as AddableStudentRow[]) ?? []).map((row) => ({
    id: row.id,
    name: row.name,
    nickname: row.nickname ?? undefined,
    level: row.level,
  }));
}
