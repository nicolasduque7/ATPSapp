import { requireCoachId } from "@/lib/auth";
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
