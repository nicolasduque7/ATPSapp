"use server";

import { revalidatePath } from "next/cache";

import { requireCoachId } from "@/lib/auth";
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
  frequency: SeriesFrequency;
  intervalCount: number;
  weekdays?: number[] | null; // required (non-empty) when frequency === "Weekly"
  dayOfMonth?: number | null; // required when frequency === "Monthly", 1-30
  startDate: Date;
  startTime: string; // "HH:mm"
  durationMinutes: number;
  endDate: Date;
}

// Frequency is intentionally absent — it's locked at creation. The action
// re-reads it from the DB after updating so a crafted request can't change
// it via this path either.
export interface ClassSeriesUpdateInput {
  studentId: string;
  locationId: string;
  type: ClassType;
  intervalCount: number;
  weekdays?: number[] | null;
  dayOfMonth?: number | null;
  startTime: string; // "HH:mm"
  durationMinutes: number;
  endDate: Date;
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

  const { data: series, error: seriesError } = await supabase
    .from("class_series")
    .insert({
      coach_id: coachId,
      student_id: input.studentId,
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

  const { data: updatedSeries, error: seriesError } = await supabase
    .from("class_series")
    .update({
      student_id: input.studentId,
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
    .eq("coach_id", coachId)
    .select("frequency")
    .single();

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
  frequency: SeriesFrequency;
  intervalCount: number;
  weekdays: number[] | null;
  dayOfMonth: number | null;
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
    .select("frequency, interval_count, weekdays, day_of_month, start_time, duration_minutes, end_date")
    .eq("id", seriesId)
    .eq("coach_id", coachId)
    .single();

  if (error) {
    console.error("getClassSeriesMeta failed:", error);
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
