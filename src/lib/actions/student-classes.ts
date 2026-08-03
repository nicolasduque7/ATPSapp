"use server";

import { revalidatePath } from "next/cache";
import { unstable_rethrow } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";

import { requireStudent } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import {
  addMinutes,
  combineClubDateAndTime,
  formatDbTimestamp,
  generateOccurrences,
  parseDateOnly,
  parseDbTimestamp,
  toClubZoned,
  type RecurrencePattern,
  type SeriesFrequency,
} from "@/lib/dates";
import type { ClassInstance, ClassType } from "@/lib/mock-data";
import { mapClassRow, CLASS_COLUMNS } from "@/lib/queries/class-row";
import {
  assertNoCoachConflict,
  assertNoStudentConflict,
  assertWithinWorkingHours,
  buildInstanceRows,
  isExclusionViolation,
} from "@/lib/actions/class-shared";
import type { ClassSeriesMeta } from "@/lib/actions/classes";
import type { ActionResult } from "@/lib/actions/result";

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;
type Translator = Awaited<ReturnType<typeof getTranslations>>;

// `coach_id references auth.users(id)` only proves the id belongs to SOME
// signed-up user, not specifically a coach — a crafted request could pass
// another student's id. This is the app-layer check that closes that gap
// (a DB-level cross-table CHECK constraint would be fragile/awkward here).
async function assertValidCoach(supabase: SupabaseServerClient, coachId: string, t: Translator): Promise<void> {
  const { data } = await supabase.from("profiles").select("id").eq("id", coachId).eq("role", "coach").maybeSingle();
  if (!data) {
    throw new Error(t("errorInvalidCoach"));
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
  isOpen: boolean;
  maxJoiners: number | null;
}

export interface StudentClassSeriesInput {
  coachId: string;
  locationId: string;
  type: ClassType;
  frequency: SeriesFrequency;
  intervalCount: number;
  weekdays?: number[] | null;
  dayOfMonth?: number | null;
  startDate: string; // "YYYY-MM-DD", club-local
  startTime: string; // "HH:mm"
  durationMinutes: number;
  endDate: string; // "YYYY-MM-DD", club-local
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
  endDate: string; // "YYYY-MM-DD", club-local
}

export async function createStudentClass(
  input: StudentClassInstanceInput,
): Promise<ActionResult<ClassInstance>> {
  try {
    const { studentId } = await requireStudent();
    const [t, locale] = await Promise.all([getTranslations("classForm"), getLocale()]);
    const supabase = await createClient();

    await assertValidCoach(supabase, input.coachId, t);
    await assertWithinWorkingHours(supabase, input.coachId, input.locationId, input.startTime, input.endTime, t);
    await assertNoStudentConflict(supabase, studentId, input.startTime, input.endTime, t, locale);
    await assertNoCoachConflict(supabase, input.coachId, input.startTime, input.endTime, t, locale);

    const { data, error } = await supabase
      .from("classes")
      .insert({
        coach_id: input.coachId,
        student_id: studentId,
        location_id: input.locationId,
        class_type: input.type,
        start_time: formatDbTimestamp(input.startTime),
        end_time: formatDbTimestamp(input.endTime),
        duration_minutes: input.durationMinutes,
        is_open: input.isOpen,
        max_joiners: input.isOpen ? input.maxJoiners : null,
      })
      .select(CLASS_COLUMNS)
      .single();

    if (error) {
      console.error("createStudentClass failed:", error);
      throw new Error(isExclusionViolation(error) ? t("errorTimeJustTaken") : t("errorBookClass"));
    }

    revalidateAll();
    return { ok: true, data: mapClassRow(data) };
  } catch (e) {
    unstable_rethrow(e);
    const t = await getTranslations("classForm");
    return { ok: false, error: e instanceof Error ? e.message : t("errorBookClass") };
  }
}

export async function createStudentClassSeries(
  input: StudentClassSeriesInput,
): Promise<ActionResult<ClassInstance[]>> {
  try {
    const { studentId } = await requireStudent();
    const [t, locale] = await Promise.all([getTranslations("classForm"), getLocale()]);
    const supabase = await createClient();

    await assertValidCoach(supabase, input.coachId, t);

    if (input.endDate < input.startDate) {
      throw new Error(t("errorUntilAfterStart"));
    }
    if (input.frequency === "Weekly" && !input.weekdays?.length) {
      throw new Error(t("errorSelectWeekday"));
    }
    if (input.frequency === "Monthly" && !input.dayOfMonth) {
      throw new Error(t("errorSelectDayOfMonth"));
    }

    const pattern: RecurrencePattern = {
      frequency: input.frequency,
      intervalCount: input.intervalCount,
      weekdays: input.frequency === "Weekly" ? input.weekdays : null,
      dayOfMonth: input.frequency === "Monthly" ? input.dayOfMonth : null,
    };
    const occurrences = generateOccurrences(pattern, parseDateOnly(input.startDate), parseDateOnly(input.endDate));
    if (occurrences.length === 0) {
      throw new Error(t("errorUntilAfterStart"));
    }

    for (const day of occurrences) {
      const startTime = combineClubDateAndTime(day, input.startTime);
      const endTime = addMinutes(startTime, input.durationMinutes);
      await assertWithinWorkingHours(supabase, input.coachId, input.locationId, startTime, endTime, t);
      await assertNoStudentConflict(supabase, studentId, startTime, endTime, t, locale);
      await assertNoCoachConflict(supabase, input.coachId, startTime, endTime, t, locale);
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
        start_date: input.startDate,
        end_date: input.endDate,
      })
      .select("id")
      .single();

    if (seriesError) {
      console.error("createStudentClassSeries failed:", seriesError);
      throw new Error(t("errorBookSeries"));
    }

    const rows = buildInstanceRows(occurrences, series.id, input.coachId, studentId, input);
    const { data, error } = await supabase.from("classes").insert(rows).select(CLASS_COLUMNS);

    if (error) {
      console.error("createStudentClassSeries instances failed:", error);
      await supabase.from("class_series").delete().eq("id", series.id);
      throw new Error(isExclusionViolation(error) ? t("errorTimeJustTakenSeries") : t("errorBookSeries"));
    }

    revalidateAll();
    return { ok: true, data: (data ?? []).map((row) => mapClassRow(row)) };
  } catch (e) {
    unstable_rethrow(e);
    const t = await getTranslations("classForm");
    return { ok: false, error: e instanceof Error ? e.message : t("errorBookSeries") };
  }
}

// Updates the series definition and regenerates its future (not-yet-started)
// instances to match; past/completed instances are left untouched — mirrors
// updateClassSeries exactly, just filtered by student_id instead of
// coach_id so a student can edit a series regardless of which coach owns it.
export async function updateStudentClassSeries(
  seriesId: string,
  input: StudentClassSeriesUpdateInput,
): Promise<ActionResult<ClassInstance[]>> {
  try {
    const { studentId } = await requireStudent();
    const [t, locale] = await Promise.all([getTranslations("classForm"), getLocale()]);
    const supabase = await createClient();
    const now = new Date();

    await assertValidCoach(supabase, input.coachId, t);

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
        end_date: input.endDate,
      })
      .eq("id", seriesId)
      .eq("student_id", studentId)
      .select("frequency")
      .single();

    if (seriesError) {
      console.error("updateStudentClassSeries failed:", seriesError);
      throw new Error(t("errorSaveSeries"));
    }

    const { error: deleteError } = await supabase
      .from("classes")
      .delete()
      .eq("series_id", seriesId)
      .eq("student_id", studentId)
      .gt("start_time", formatDbTimestamp(now));

    if (deleteError) {
      console.error("updateStudentClassSeries (clearing future instances) failed:", deleteError);
      throw new Error(t("errorSaveSeries"));
    }

    const pattern: RecurrencePattern = {
      frequency: updatedSeries.frequency,
      intervalCount: input.intervalCount,
      weekdays: input.weekdays,
      dayOfMonth: input.dayOfMonth,
    };
    const occurrences = generateOccurrences(pattern, toClubZoned(now), parseDateOnly(input.endDate)).filter(
      (day) => combineClubDateAndTime(day, input.startTime) > now,
    );

    if (occurrences.length > 0) {
      for (const day of occurrences) {
        const startTime = combineClubDateAndTime(day, input.startTime);
        const endTime = addMinutes(startTime, input.durationMinutes);
        await assertWithinWorkingHours(supabase, input.coachId, input.locationId, startTime, endTime, t);
        await assertNoStudentConflict(supabase, studentId, startTime, endTime, t, locale);
        await assertNoCoachConflict(supabase, input.coachId, startTime, endTime, t, locale);
      }

      const rows = buildInstanceRows(occurrences, seriesId, input.coachId, studentId, input);
      const { error: insertError } = await supabase.from("classes").insert(rows);
      if (insertError) {
        console.error("updateStudentClassSeries (inserting future instances) failed:", insertError);
        throw new Error(isExclusionViolation(insertError) ? t("errorTimeJustTakenSeries") : t("errorSaveSeries"));
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
      throw new Error(t("errorRefreshSeries"));
    }

    revalidateAll();
    return { ok: true, data: (data ?? []).map((row) => mapClassRow(row, parseDbTimestamp(row.end_time) < now)) };
  } catch (e) {
    unstable_rethrow(e);
    const t = await getTranslations("classForm");
    return { ok: false, error: e instanceof Error ? e.message : t("errorSaveSeries") };
  }
}

// Student-side equivalent of getClassSeriesMeta, filtered by student_id so a
// student can hydrate "whole series" edit fields regardless of which coach
// owns the series.
export async function getStudentClassSeriesMeta(seriesId: string): Promise<ClassSeriesMeta> {
  const { studentId } = await requireStudent();
  const t = await getTranslations("classForm");
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("class_series")
    .select("frequency, interval_count, weekdays, day_of_month, start_time, duration_minutes, end_date")
    .eq("id", seriesId)
    .eq("student_id", studentId)
    .single();

  if (error) {
    console.error("getStudentClassSeriesMeta failed:", error);
    throw new Error(t("errorLoadSeries"));
  }

  return {
    frequency: data.frequency,
    intervalCount: data.interval_count,
    weekdays: data.weekdays,
    dayOfMonth: data.day_of_month,
    startTime: data.start_time.slice(0, 5),
    durationMinutes: data.duration_minutes,
    endDate: data.end_date,
  };
}

export async function updateStudentClassInstance(
  id: string,
  input: StudentClassInstanceInput,
): Promise<ActionResult<ClassInstance>> {
  try {
    const { studentId } = await requireStudent();
    const [t, locale] = await Promise.all([getTranslations("classForm"), getLocale()]);
    const supabase = await createClient();

    await assertValidCoach(supabase, input.coachId, t);
    await assertWithinWorkingHours(supabase, input.coachId, input.locationId, input.startTime, input.endTime, t);
    await assertNoStudentConflict(supabase, studentId, input.startTime, input.endTime, t, locale, id);
    await assertNoCoachConflict(supabase, input.coachId, input.startTime, input.endTime, t, locale, id);

    const { data, error } = await supabase
      .from("classes")
      .update({
        coach_id: input.coachId,
        location_id: input.locationId,
        class_type: input.type,
        start_time: formatDbTimestamp(input.startTime),
        end_time: formatDbTimestamp(input.endTime),
        duration_minutes: input.durationMinutes,
        is_open: input.isOpen,
        max_joiners: input.isOpen ? input.maxJoiners : null,
      })
      .eq("id", id)
      .eq("student_id", studentId)
      .select(CLASS_COLUMNS)
      .single();

    if (error) {
      console.error("updateStudentClassInstance failed:", error);
      throw new Error(isExclusionViolation(error) ? t("errorTimeJustTaken") : t("errorSaveClass"));
    }

    revalidateAll();
    return { ok: true, data: mapClassRow(data) };
  } catch (e) {
    unstable_rethrow(e);
    const t = await getTranslations("classForm");
    return { ok: false, error: e instanceof Error ? e.message : t("errorSaveClass") };
  }
}

export async function deleteStudentClassInstance(id: string): Promise<ActionResult> {
  try {
    const { studentId } = await requireStudent();
    const t = await getTranslations("classForm");
    const supabase = await createClient();

    const { error } = await supabase.from("classes").delete().eq("id", id).eq("student_id", studentId);

    if (error) {
      console.error("deleteStudentClassInstance failed:", error);
      throw new Error(t("errorDeleteClassAction"));
    }

    revalidateAll();
    return { ok: true, data: undefined };
  } catch (e) {
    unstable_rethrow(e);
    const t = await getTranslations("classForm");
    return { ok: false, error: e instanceof Error ? e.message : t("errorDeleteClassAction") };
  }
}

export async function deleteStudentClassSeries(seriesId: string): Promise<ActionResult> {
  try {
    const { studentId } = await requireStudent();
    const t = await getTranslations("classForm");
    const supabase = await createClient();

    const { error } = await supabase
      .from("class_series")
      .delete()
      .eq("id", seriesId)
      .eq("student_id", studentId);

    if (error) {
      console.error("deleteStudentClassSeries failed:", error);
      throw new Error(t("errorDeleteSeriesAction"));
    }

    revalidateAll();
    return { ok: true, data: undefined };
  } catch (e) {
    unstable_rethrow(e);
    const t = await getTranslations("classForm");
    return { ok: false, error: e instanceof Error ? e.message : t("errorDeleteSeriesAction") };
  }
}
