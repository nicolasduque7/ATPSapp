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
  forehandRating: number;
  backhandRating: number;
  backhandSliceRating: number;
  volleyRating: number;
  serveRating: number;
  dropShotRating: number;
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
      forehand_rating: input.forehandRating,
      backhand_rating: input.backhandRating,
      backhand_slice_rating: input.backhandSliceRating,
      volley_rating: input.volleyRating,
      serve_rating: input.serveRating,
      drop_shot_rating: input.dropShotRating,
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
  await requireCoachId();
  const supabase = await createClient();

  // Students are a shared, club-wide roster — any signed-in coach may edit
  // any student, not just the one who originally added them.
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
      forehand_rating: input.forehandRating,
      backhand_rating: input.backhandRating,
      backhand_slice_rating: input.backhandSliceRating,
      volley_rating: input.volleyRating,
      serve_rating: input.serveRating,
      drop_shot_rating: input.dropShotRating,
    })
    .eq("id", id)
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
  await requireCoachId();
  const supabase = await createClient();

  const { error } = await supabase.from("students").delete().eq("id", id);

  if (error) {
    console.error("deleteStudent failed:", error);
    // 23503 = foreign_key_violation — a class or series still references
    // this student (any coach's, since students are shared club-wide).
    throw new Error(
      error.code === "23503"
        ? "Couldn't delete — this student still has classes on the calendar. Remove those first."
        : "Couldn't delete student. Try again.",
    );
  }

  revalidatePath("/students");
}
