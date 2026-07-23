"use server";

import { revalidatePath } from "next/cache";

import { requireCoachId } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatDateOnly } from "@/lib/dates";
import type { Gender, Hand, Student, StudentLevel } from "@/lib/mock-data";
import { mapStudentRow, STUDENT_COLUMNS } from "@/lib/queries/student-row";

export interface StudentInput {
  name: string;
  nickname?: string;
  level: StudentLevel;
  age: number;
  gender: Gender;
  hand: Hand;
  racketType?: string;
  since: Date;
  coachingNote?: string;
}

export async function createStudent(input: StudentInput): Promise<Student> {
  const coachId = await requireCoachId();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("students")
    .insert({
      coach_id: coachId,
      name: input.name,
      nickname: input.nickname ?? null,
      level: input.level,
      age: input.age,
      gender: input.gender,
      hand: input.hand,
      racket_type: input.racketType ?? null,
      since: formatDateOnly(input.since),
      coaching_note: input.coachingNote ?? null,
    })
    .select(STUDENT_COLUMNS)
    .single();

  if (error) {
    console.error("createStudent failed:", error);
    throw new Error("Couldn't create student. Try again.");
  }

  revalidatePath("/students");
  return mapStudentRow(data);
}

export async function updateStudent(id: string, input: StudentInput): Promise<Student> {
  const coachId = await requireCoachId();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("students")
    .update({
      name: input.name,
      nickname: input.nickname ?? null,
      level: input.level,
      age: input.age,
      gender: input.gender,
      hand: input.hand,
      racket_type: input.racketType ?? null,
      since: formatDateOnly(input.since),
      coaching_note: input.coachingNote ?? null,
    })
    .eq("id", id)
    .eq("coach_id", coachId)
    .select(STUDENT_COLUMNS)
    .single();

  if (error) {
    console.error("updateStudent failed:", error);
    throw new Error("Couldn't save student. Try again.");
  }

  revalidatePath("/students");
  return mapStudentRow(data);
}

export async function deleteStudent(id: string): Promise<void> {
  const coachId = await requireCoachId();
  const supabase = await createClient();

  const { error } = await supabase
    .from("students")
    .delete()
    .eq("id", id)
    .eq("coach_id", coachId);

  if (error) {
    console.error("deleteStudent failed:", error);
    throw new Error("Couldn't delete student. Try again.");
  }

  revalidatePath("/students");
}
