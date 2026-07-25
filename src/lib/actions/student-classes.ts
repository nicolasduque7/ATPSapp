"use server";

import { revalidatePath } from "next/cache";

import { requireStudent } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import {
  addMinutes,
  combineDateAndTime,
  formatDateOnly,
  generateOccurrences,
  parseDateOnly,
  toLocalTimestamp,
  type RecurrencePattern,
  type SeriesFrequency,
} from "@/lib/dates";
import type { ClassInstance, ClassType } from "@/lib/mock-data";
import { mapClassRow, CLASS_COLUMNS } from "@/lib/queries/class-row";
import {
  assertNoCoachConflict,
  assertNoStudentConflict,
  buildInstanceRows,
  isExclusionViolation,
} from "@/lib/actions/class-shared";
import type { ClassSeriesMeta } from "@/lib/actions/classes";

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

// `coach_id references auth.users(id)` only proves the id belongs to SOME
// signed-up user, not specifically a coach — a crafted request could pass
// another student's id. This is the app-layer check that closes that gap
// (a DB-level cross-table CHECK constraint would be fragile/awkward here).
async function assertValidCoach(supabase: SupabaseServerClient, coachId: string): Promise<void> {
  const { data } = await supabase.from("profiles").select("id").eq("id", coachId).eq("role", "coach").maybeSingle();
  if (!data) {
    throw new Error("Please choose a valid coach.");
  }
}

function revalidateAll(): void {
  revalidatePath("/student");
  revalidatePath("/student/calendar");
  revalidatePath("/");
  revalidatePath("/students");
  revalidatePath("/calendar");
}

export interface StudentClassInstanceInput {
  coachId: string;
  locationId: string;
  type: ClassType;
  startTime: Date;
  endTime: Date;
  durationMinutes: number;
}

export interface StudentClassSeriesInput {
  coachId: string;
  locationId: string;
  type: ClassType;
  frequency: SeriesFrequency;
  intervalCount: number;
  weekdays?: number[] | null;
  dayOfMonth?: number | null;
  startDate: Date;
  startTime: string; // "HH:mm"
  durationMinutes: number;
  endDate: Date;
}

export interface StudentClassSeriesUpdateInput {
  coachId: string;
  locationId: string;
  type: ClassType;
  intervalCount: number;
  weekdays?: number[] | null;
  dayOfMonth?: number | null;
  startTime: string; // "HH:mm"
  durationMinutes: number;
  endDate: Date;
}

export async function createStudentClass(input: StudentClassInstanceInput): Promise<ClassInstance> {
  const { studentId } = await requireStudent();
  const supabase = await createClient();

  await assertValidCoach(supabase, input.coachId);
  await assertNoStudentConflict(supabase, studentId, input.startTime, input.endTime);
  await assertNoCoachConflict(supabase, input.coachId, input.startTime, input.endTime);

  const { data, error } = await supabase
    .from("classes")
    .insert({
      coach_id: input.coachId,
      student_id: studentId,
      location_id: input.locationId,
      class_type: input.type,
      start_time: toLocalTimestamp(input.startTime),
      end_time: toLocalTimestamp(input.endTime),
      duration_minutes: input.durationMinutes,
    })
    .select(CLASS_COLUMNS)
    .single();

  if (error) {
    console.error("createStudentClass failed:", error);
    throw new Error(
      isExclusionViolation(error)
        ? "That time was just taken — please try again."
        : "Couldn't book the class. Try again.",
    );
  }

  revalidateAll();
  return mapClassRow(data);
}

export async function createStudentClassSeries(input: StudentClassSeriesInput): Promise<ClassInstance[]> {
  const { studentId } = await requireStudent();
  const supabase = await createClient();

  await assertValidCoach(supabase, input.coachId);

  if (input.endDate < input.startDate) {
    throw new Error("Until date must be on or after the start date.");
  }
  if (input.frequency === "Weekly" && !input.weekdays?.length) {
    throw new Error("Select at least one day of the week.");
  }
  if (input.frequency === "Monthly" && !input.dayOfMonth) {
    throw new Error("Select a day of the month.");
  }

  const pattern: RecurrencePattern = {
    frequency: input.frequency,
    intervalCount: input.intervalCount,
    weekdays: input.frequency === "Weekly" ? input.weekdays : null,
    dayOfMonth: input.frequency === "Monthly" ? input.dayOfMonth : null,
  };
  const occurrences = generateOccurrences(pattern, input.startDate, input.endDate);
  if (occurrences.length === 0) {
    throw new Error("Until date must be on or after the start date.");
  }

  for (const day of occurrences) {
    const startTime = combineDateAndTime(day, input.startTime);
    const endTime = addMinutes(startTime, input.durationMinutes);
    await assertNoStudentConflict(supabase, studentId, startTime, endTime);
    await assertNoCoachConflict(supabase, input.coachId, startTime, endTime);
  }

  const { data: series, error: seriesError } = await supabase
    .from("class_series")
    .insert({
      coach_id: input.coachId,
      student_id: studentId,
      location_id: input.locationId,
      class_type: input.type,
      frequency: input.frequency,
      interval_count: input.intervalCount,
      weekdays: pattern.weekdays,
      day_of_month: pattern.dayOfMonth,
      start_time: `${input.startTime}:00`,
      duration_minutes: input.durationMinutes,
      start_date: formatDateOnly(input.startDate),
      end_date: formatDateOnly(input.endDate),
    })
    .select("id")
    .single();

  if (seriesError) {
    console.error("createStudentClassSeries failed:", seriesError);
    throw new Error("Couldn't book the recurring series. Try again.");
  }

  const rows = buildInstanceRows(occurrences, series.id, input.coachId, studentId, input);
  const { data, error } = await supabase.from("classes").insert(rows).select(CLASS_COLUMNS);

  if (error) {
    console.error("createStudentClassSeries instances failed:", error);
    await supabase.from("class_series").delete().eq("id", series.id);
    throw new Error(
      isExclusionViolation(error)
        ? "One of these classes' times was just taken — please try again."
        : "Couldn't book the recurring series. Try again.",
    );
  }

  revalidateAll();
  return (data ?? []).map((row) => mapClassRow(row));
}

// Updates the series definition and regenerates its future (not-yet-started)
// instances to match; past/completed instances are left untouched — mirrors
// updateClassSeries exactly, just filtered by student_id instead of
// coach_id so a student can edit a series regardless of which coach owns it.
export async function updateStudentClassSeries(
  seriesId: string,
  input: StudentClassSeriesUpdateInput,
): Promise<ClassInstance[]> {
  const { studentId } = await requireStudent();
  const supabase = await createClient();
  const now = new Date();

  await assertValidCoach(supabase, input.coachId);

  const { data: updatedSeries, error: seriesError } = await supabase
    .from("class_series")
    .update({
      coach_id: input.coachId,
      location_id: input.locationId,
      class_type: input.type,
      interval_count: input.intervalCount,
      weekdays: input.weekdays ?? null,
      day_of_month: input.dayOfMonth ?? null,
      start_time: `${input.startTime}:00`,
      duration_minutes: input.durationMinutes,
      end_date: formatDateOnly(input.endDate),
    })
    .eq("id", seriesId)
    .eq("student_id", studentId)
    .select("frequency")
    .single();

  if (seriesError) {
    console.error("updateStudentClassSeries failed:", seriesError);
    throw new Error("Couldn't save the series. Try again.");
  }

  const { error: deleteError } = await supabase
    .from("classes")
    .delete()
    .eq("series_id", seriesId)
    .eq("student_id", studentId)
    .gt("start_time", toLocalTimestamp(now));

  if (deleteError) {
    console.error("updateStudentClassSeries (clearing future instances) failed:", deleteError);
    throw new Error("Couldn't save the series. Try again.");
  }

  const pattern: RecurrencePattern = {
    frequency: updatedSeries.frequency,
    intervalCount: input.intervalCount,
    weekdays: input.weekdays,
    dayOfMonth: input.dayOfMonth,
  };
  const occurrences = generateOccurrences(pattern, now, input.endDate).filter(
    (day) => combineDateAndTime(day, input.startTime) > now,
  );

  if (occurrences.length > 0) {
    for (const day of occurrences) {
      const startTime = combineDateAndTime(day, input.startTime);
      const endTime = addMinutes(startTime, input.durationMinutes);
      await assertNoStudentConflict(supabase, studentId, startTime, endTime);
      await assertNoCoachConflict(supabase, input.coachId, startTime, endTime);
    }

    const rows = buildInstanceRows(occurrences, seriesId, input.coachId, studentId, input);
    const { error: insertError } = await supabase.from("classes").insert(rows);
    if (insertError) {
      console.error("updateStudentClassSeries (inserting future instances) failed:", insertError);
      throw new Error(
        isExclusionViolation(insertError)
          ? "One of these classes' times was just taken — please try again."
          : "Couldn't save the series. Try again.",
      );
    }
  }

  const { data, error } = await supabase
    .from("classes")
    .select(CLASS_COLUMNS)
    .eq("series_id", seriesId)
    .eq("student_id", studentId)
    .order("start_time");

  if (error) {
    console.error("updateStudentClassSeries (refetch) failed:", error);
    throw new Error("Couldn't refresh the series. Try again.");
  }

  revalidateAll();
  return (data ?? []).map((row) => mapClassRow(row, new Date(row.end_time) < now));
}

// Student-side equivalent of getClassSeriesMeta, filtered by student_id so a
// student can hydrate "whole series" edit fields regardless of which coach
// owns the series.
export async function getStudentClassSeriesMeta(seriesId: string): Promise<ClassSeriesMeta> {
  const { studentId } = await requireStudent();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("class_series")
    .select("frequency, interval_count, weekdays, day_of_month, start_time, duration_minutes, end_date")
    .eq("id", seriesId)
    .eq("student_id", studentId)
    .single();

  if (error) {
    console.error("getStudentClassSeriesMeta failed:", error);
    throw new Error("Couldn't load the series. Try again.");
  }

  return {
    frequency: data.frequency,
    intervalCount: data.interval_count,
    weekdays: data.weekdays,
    dayOfMonth: data.day_of_month,
    startTime: data.start_time.slice(0, 5),
    durationMinutes: data.duration_minutes,
    endDate: parseDateOnly(data.end_date),
  };
}

export async function updateStudentClassInstance(
  id: string,
  input: StudentClassInstanceInput,
): Promise<ClassInstance> {
  const { studentId } = await requireStudent();
  const supabase = await createClient();

  await assertValidCoach(supabase, input.coachId);
  await assertNoStudentConflict(supabase, studentId, input.startTime, input.endTime, id);
  await assertNoCoachConflict(supabase, input.coachId, input.startTime, input.endTime, id);

  const { data, error } = await supabase
    .from("classes")
    .update({
      coach_id: input.coachId,
      location_id: input.locationId,
      class_type: input.type,
      start_time: toLocalTimestamp(input.startTime),
      end_time: toLocalTimestamp(input.endTime),
      duration_minutes: input.durationMinutes,
    })
    .eq("id", id)
    .eq("student_id", studentId)
    .select(CLASS_COLUMNS)
    .single();

  if (error) {
    console.error("updateStudentClassInstance failed:", error);
    throw new Error(
      isExclusionViolation(error)
        ? "That time was just taken — please try again."
        : "Couldn't save class. Try again.",
    );
  }

  revalidateAll();
  return mapClassRow(data);
}

export async function deleteStudentClassInstance(id: string): Promise<void> {
  const { studentId } = await requireStudent();
  const supabase = await createClient();

  const { error } = await supabase.from("classes").delete().eq("id", id).eq("student_id", studentId);

  if (error) {
    console.error("deleteStudentClassInstance failed:", error);
    throw new Error("Couldn't delete class. Try again.");
  }

  revalidateAll();
}

export async function deleteStudentClassSeries(seriesId: string): Promise<void> {
  const { studentId } = await requireStudent();
  const supabase = await createClient();

  const { error } = await supabase
    .from("class_series")
    .delete()
    .eq("id", seriesId)
    .eq("student_id", studentId);

  if (error) {
    console.error("deleteStudentClassSeries failed:", error);
    throw new Error("Couldn't delete the series. Try again.");
  }

  revalidateAll();
}
