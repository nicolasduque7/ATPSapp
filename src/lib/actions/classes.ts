"use server";

import { revalidatePath } from "next/cache";

import { requireCoachId } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { toLocalTimestamp } from "@/lib/dates";
import type { ClassInstance, ClassType } from "@/lib/mock-data";
import { mapClassRow, CLASS_COLUMNS } from "@/lib/queries/class-row";

export interface ClassInstanceInput {
  studentId: string;
  locationId: string;
  type: ClassType;
  startTime: Date;
  endTime: Date;
  durationMinutes: number;
}

export async function updateClassInstance(
  id: string,
  input: ClassInstanceInput,
): Promise<ClassInstance> {
  const coachId = await requireCoachId();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("classes")
    .update({
      student_id: input.studentId,
      location_id: input.locationId,
      class_type: input.type,
      start_time: toLocalTimestamp(input.startTime),
      end_time: toLocalTimestamp(input.endTime),
      duration_minutes: input.durationMinutes,
    })
    .eq("id", id)
    .eq("coach_id", coachId)
    .select(CLASS_COLUMNS)
    .single();

  if (error) {
    console.error("updateClassInstance failed:", error);
    throw new Error("Couldn't save class. Try again.");
  }

  revalidatePath("/students");
  revalidatePath("/calendar");
  return mapClassRow(data);
}

export async function deleteClassInstance(id: string): Promise<void> {
  const coachId = await requireCoachId();
  const supabase = await createClient();

  const { error } = await supabase.from("classes").delete().eq("id", id).eq("coach_id", coachId);

  if (error) {
    console.error("deleteClassInstance failed:", error);
    throw new Error("Couldn't delete class. Try again.");
  }

  revalidatePath("/students");
  revalidatePath("/calendar");
}

// Deletes the recurring series and every instance it generated (past and
// future) via the class_series -> classes cascade delete.
export async function deleteClassSeries(seriesId: string): Promise<void> {
  const coachId = await requireCoachId();
  const supabase = await createClient();

  const { error } = await supabase
    .from("class_series")
    .delete()
    .eq("id", seriesId)
    .eq("coach_id", coachId);

  if (error) {
    console.error("deleteClassSeries failed:", error);
    throw new Error("Couldn't delete the series. Try again.");
  }

  revalidatePath("/students");
  revalidatePath("/calendar");
}
