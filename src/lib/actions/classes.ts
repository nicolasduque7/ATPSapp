"use server";

import { revalidatePath } from "next/cache";

import { requireCoachId } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import {
  addMinutes,
  combineDateAndTime,
  formatDateOnly,
  generateWeeklyOccurrences,
  parseDateOnly,
  toLocalTimestamp,
} from "@/lib/dates";
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

export interface ClassSeriesInput {
  studentId: string;
  locationId: string;
  type: ClassType;
  startDate: Date;
  startTime: string; // "HH:mm"; weekday is derived from startDate
  durationMinutes: number;
  endDate: Date;
}

export interface ClassSeriesUpdateInput {
  studentId: string;
  locationId: string;
  type: ClassType;
  weekday: number; // 0 = Monday .. 6 = Sunday
  startTime: string; // "HH:mm"
  durationMinutes: number;
  endDate: Date;
}

function weekdayOf(date: Date): number {
  return (date.getDay() + 6) % 7;
}

interface SeriesInstanceRow {
  coach_id: string;
  student_id: string;
  location_id: string;
  series_id: string;
  class_type: ClassType;
  start_time: string;
  end_time: string;
  duration_minutes: number;
}

function buildInstanceRows(
  occurrences: Date[],
  seriesId: string,
  coachId: string,
  input: Pick<ClassSeriesInput, "studentId" | "locationId" | "type" | "startTime" | "durationMinutes">,
): SeriesInstanceRow[] {
  return occurrences.map((day) => {
    const startTime = combineDateAndTime(day, input.startTime);
    const endTime = addMinutes(startTime, input.durationMinutes);
    return {
      coach_id: coachId,
      student_id: input.studentId,
      location_id: input.locationId,
      series_id: seriesId,
      class_type: input.type,
      start_time: toLocalTimestamp(startTime),
      end_time: toLocalTimestamp(endTime),
      duration_minutes: input.durationMinutes,
    };
  });
}

export async function createClass(input: ClassInstanceInput): Promise<ClassInstance> {
  const coachId = await requireCoachId();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("classes")
    .insert({
      coach_id: coachId,
      student_id: input.studentId,
      location_id: input.locationId,
      class_type: input.type,
      start_time: toLocalTimestamp(input.startTime),
      end_time: toLocalTimestamp(input.endTime),
      duration_minutes: input.durationMinutes,
    })
    .select(CLASS_COLUMNS)
    .single();

  if (error) {
    console.error("createClass failed:", error);
    throw new Error("Couldn't create the class. Try again.");
  }

  revalidatePath("/students");
  revalidatePath("/calendar");
  return mapClassRow(data);
}

export async function createClassSeries(input: ClassSeriesInput): Promise<ClassInstance[]> {
  const coachId = await requireCoachId();
  const supabase = await createClient();

  if (input.endDate < input.startDate) {
    throw new Error("Until date must be on or after the start date.");
  }

  const weekday = weekdayOf(input.startDate);
  const occurrences = generateWeeklyOccurrences(input.startDate, input.endDate, weekday);
  if (occurrences.length === 0) {
    throw new Error("Until date must be on or after the start date.");
  }

  const { data: series, error: seriesError } = await supabase
    .from("class_series")
    .insert({
      coach_id: coachId,
      student_id: input.studentId,
      location_id: input.locationId,
      class_type: input.type,
      weekday,
      start_time: `${input.startTime}:00`,
      duration_minutes: input.durationMinutes,
      start_date: formatDateOnly(input.startDate),
      end_date: formatDateOnly(input.endDate),
    })
    .select("id")
    .single();

  if (seriesError) {
    console.error("createClassSeries failed:", seriesError);
    throw new Error("Couldn't create the recurring series. Try again.");
  }

  const rows = buildInstanceRows(occurrences, series.id, coachId, input);
  const { data, error } = await supabase.from("classes").insert(rows).select(CLASS_COLUMNS);

  if (error) {
    console.error("createClassSeries instances failed:", error);
    await supabase.from("class_series").delete().eq("id", series.id);
    throw new Error("Couldn't create the recurring series. Try again.");
  }

  revalidatePath("/students");
  revalidatePath("/calendar");
  return (data ?? []).map((row) => mapClassRow(row));
}

// Updates the series definition and regenerates its future (not-yet-started)
// instances to match; past/completed instances are left untouched so
// historical records (and the hours-coached stat) stay accurate.
export async function updateClassSeries(
  seriesId: string,
  input: ClassSeriesUpdateInput,
): Promise<ClassInstance[]> {
  const coachId = await requireCoachId();
  const supabase = await createClient();
  const now = new Date();

  const { error: seriesError } = await supabase
    .from("class_series")
    .update({
      student_id: input.studentId,
      location_id: input.locationId,
      class_type: input.type,
      weekday: input.weekday,
      start_time: `${input.startTime}:00`,
      duration_minutes: input.durationMinutes,
      end_date: formatDateOnly(input.endDate),
    })
    .eq("id", seriesId)
    .eq("coach_id", coachId);

  if (seriesError) {
    console.error("updateClassSeries failed:", seriesError);
    throw new Error("Couldn't save the series. Try again.");
  }

  const { error: deleteError } = await supabase
    .from("classes")
    .delete()
    .eq("series_id", seriesId)
    .eq("coach_id", coachId)
    .gt("start_time", toLocalTimestamp(now));

  if (deleteError) {
    console.error("updateClassSeries (clearing future instances) failed:", deleteError);
    throw new Error("Couldn't save the series. Try again.");
  }

  const occurrences = generateWeeklyOccurrences(now, input.endDate, input.weekday).filter(
    (day) => combineDateAndTime(day, input.startTime) > now,
  );

  if (occurrences.length > 0) {
    const rows = buildInstanceRows(occurrences, seriesId, coachId, input);
    const { error: insertError } = await supabase.from("classes").insert(rows);
    if (insertError) {
      console.error("updateClassSeries (inserting future instances) failed:", insertError);
      throw new Error("Couldn't save the series. Try again.");
    }
  }

  const { data, error } = await supabase
    .from("classes")
    .select(CLASS_COLUMNS)
    .eq("series_id", seriesId)
    .eq("coach_id", coachId)
    .order("start_time");

  if (error) {
    console.error("updateClassSeries (refetch) failed:", error);
    throw new Error("Couldn't refresh the series. Try again.");
  }

  revalidatePath("/students");
  revalidatePath("/calendar");
  return (data ?? []).map((row) => mapClassRow(row, new Date(row.end_time) < now));
}

export interface ClassSeriesMeta {
  weekday: number;
  startTime: string; // "HH:mm"
  durationMinutes: number;
  endDate: Date;
}

// Lets the edit dialog lazily load the authoritative recurrence pattern
// when a coach switches to "whole series" scope, rather than guessing it
// from the single instance they clicked.
export async function getClassSeriesMeta(seriesId: string): Promise<ClassSeriesMeta> {
  const coachId = await requireCoachId();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("class_series")
    .select("weekday, start_time, duration_minutes, end_date")
    .eq("id", seriesId)
    .eq("coach_id", coachId)
    .single();

  if (error) {
    console.error("getClassSeriesMeta failed:", error);
    throw new Error("Couldn't load the series. Try again.");
  }

  return {
    weekday: data.weekday,
    startTime: data.start_time.slice(0, 5),
    durationMinutes: data.duration_minutes,
    endDate: parseDateOnly(data.end_date),
  };
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
