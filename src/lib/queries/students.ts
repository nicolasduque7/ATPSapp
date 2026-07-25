import { requireCoachId, requireStudent } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { Student } from "@/lib/mock-data";
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
