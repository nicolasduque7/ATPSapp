"use server";

import { revalidatePath } from "next/cache";
import { unstable_rethrow } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";

import { requireCoachId } from "@/lib/auth";
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
  assertValidRoster,
  assertWithinWorkingHours,
  buildInstanceRows,
  buildParticipantRows,
  getParticipantsByClassId,
  getStudentDisplayNames,
  isExclusionViolation,
} from "@/lib/actions/class-shared";
import type { ActionResult } from "@/lib/actions/result";

// `studentIds` is the FULL roster (host + participants), in the order
// picked — `studentIds[0]` becomes `classes.student_id` (the host), the
// rest become `class_participants` rows. For a Private class this is
// always exactly one id (enforced by assertValidRoster).
export interface ClassInstanceInput {
  studentIds: string[];
  locationId: string;
  type: ClassType;
  startTime: Date;
  endTime: Date;
  durationMinutes: number;
  isOpen: boolean;
  maxJoiners: number | null;
}

export interface ClassSeriesInput {
  studentIds: string[];
  locationId: string;
  type: ClassType;
  frequency: SeriesFrequency;
  intervalCount: number;
  weekdays?: number[] | null; // required (non-empty) when frequency === "Weekly"
  dayOfMonth?: number | null; // required when frequency === "Monthly", 1-30
  startDate: string; // "YYYY-MM-DD", club-local — a pure calendar date, never a Date
  // instant, so it can cross the client/server boundary as a plain string
  // with no timezone-reinterpretation risk.
  startTime: string; // "HH:mm"
  durationMinutes: number;
  endDate: string; // "YYYY-MM-DD", club-local — see startDate
}

// Frequency is intentionally absent — it's locked at creation. The action
// re-reads it from the DB after updating so a crafted request can't change
// it via this path either.
export interface ClassSeriesUpdateInput {
  studentIds: string[];
  locationId: string;
  type: ClassType;
  intervalCount: number;
  weekdays?: number[] | null;
  dayOfMonth?: number | null;
  startTime: string; // "HH:mm"
  durationMinutes: number;
  endDate: string; // "YYYY-MM-DD", club-local
}

// Sequential per-student conflict checks, in roster order. `names` is only
// populated (and only consulted) when there's more than one student, so the
// rejection message can name exactly who has the conflict.
async function assertNoConflictForRoster(
  supabase: Awaited<ReturnType<typeof createClient>>,
  studentIds: string[],
  startTime: Date,
  endTime: Date,
  t: Awaited<ReturnType<typeof getTranslations>>,
  locale: string,
  excludeClassId?: string,
): Promise<void> {
  const names = studentIds.length > 1 ? await getStudentDisplayNames(supabase, studentIds) : new Map<string, string>();
  for (const studentId of studentIds) {
    await assertNoStudentConflict(supabase, studentId, startTime, endTime, t, locale, excludeClassId, names.get(studentId));
  }
}

export async function createClass(input: ClassInstanceInput): Promise<ActionResult<ClassInstance>> {
  try {
    const coachId = await requireCoachId();
    const [t, locale] = await Promise.all([getTranslations("classForm"), getLocale()]);
    const supabase = await createClient();

    assertValidRoster(input.studentIds, input.type, t);
    const [hostId, ...participantIds] = input.studentIds;

    await assertWithinWorkingHours(supabase, coachId, input.locationId, input.startTime, input.endTime, t);
    await assertNoConflictForRoster(supabase, input.studentIds, input.startTime, input.endTime, t, locale);
    await assertNoCoachConflict(supabase, coachId, input.startTime, input.endTime, t, locale);

    const { data, error } = await supabase
      .from("classes")
      .insert({
        coach_id: coachId,
        student_id: hostId,
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
      console.error("createClass failed:", error);
      throw new Error(isExclusionViolation(error) ? t("errorTimeJustTaken") : t("errorCreateClass"));
    }

    if (participantIds.length > 0) {
      const rows = participantIds.map((studentId) => ({
        class_id: data.id,
        student_id: studentId,
        start_time: formatDbTimestamp(input.startTime),
        end_time: formatDbTimestamp(input.endTime),
      }));
      const { error: participantError } = await supabase.from("class_participants").insert(rows);
      if (participantError) {
        console.error("createClass participants failed:", participantError);
        await supabase.from("classes").delete().eq("id", data.id);
        throw new Error(isExclusionViolation(participantError) ? t("errorTimeJustTaken") : t("errorCreateClass"));
      }
    }

    revalidatePath("/");
    revalidatePath("/students");
    revalidatePath("/calendar");
    return { ok: true, data: mapClassRow(data, false, participantIds) };
  } catch (e) {
    unstable_rethrow(e);
    const t = await getTranslations("classForm");
    return { ok: false, error: e instanceof Error ? e.message : t("errorCreateClass") };
  }
}

export async function createClassSeries(input: ClassSeriesInput): Promise<ActionResult<ClassInstance[]>> {
  try {
    const coachId = await requireCoachId();
    const [t, locale] = await Promise.all([getTranslations("classForm"), getLocale()]);
    const supabase = await createClient();

    assertValidRoster(input.studentIds, input.type, t);
    const [hostId, ...participantIds] = input.studentIds;

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
      await assertWithinWorkingHours(supabase, coachId, input.locationId, startTime, endTime, t);
      await assertNoConflictForRoster(supabase, input.studentIds, startTime, endTime, t, locale);
      await assertNoCoachConflict(supabase, coachId, startTime, endTime, t, locale);
    }

    const { data: series, error: seriesError } = await supabase
      .from("class_series")
      .insert({
        coach_id: coachId,
        student_id: hostId,
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
      console.error("createClassSeries failed:", seriesError);
      throw new Error(t("errorCreateSeries"));
    }

    const rows = buildInstanceRows(occurrences, series.id, coachId, hostId, input);
    const { data, error } = await supabase.from("classes").insert(rows).select(CLASS_COLUMNS);

    if (error) {
      console.error("createClassSeries instances failed:", error);
      await supabase.from("class_series").delete().eq("id", series.id);
      throw new Error(isExclusionViolation(error) ? t("errorTimeJustTakenSeries") : t("errorCreateSeries"));
    }

    if (participantIds.length > 0) {
      const participantRows = buildParticipantRows(data, participantIds);
      const { error: participantError } = await supabase.from("class_participants").insert(participantRows);
      if (participantError) {
        console.error("createClassSeries participants failed:", participantError);
        await supabase.from("class_series").delete().eq("id", series.id);
        throw new Error(
          isExclusionViolation(participantError) ? t("errorTimeJustTakenSeries") : t("errorCreateSeries"),
        );
      }
    }

    revalidatePath("/");
    revalidatePath("/students");
    revalidatePath("/calendar");
    return { ok: true, data: (data ?? []).map((row) => mapClassRow(row, false, participantIds)) };
  } catch (e) {
    unstable_rethrow(e);
    const t = await getTranslations("classForm");
    return { ok: false, error: e instanceof Error ? e.message : t("errorCreateSeries") };
  }
}

// Updates the series definition and regenerates its future (not-yet-started)
// instances to match; past/completed instances are left untouched so
// historical records (and the hours-coached stat) stay accurate.
export async function updateClassSeries(
  seriesId: string,
  input: ClassSeriesUpdateInput,
): Promise<ActionResult<ClassInstance[]>> {
  try {
    const coachId = await requireCoachId();
    const [t, locale] = await Promise.all([getTranslations("classForm"), getLocale()]);
    const supabase = await createClient();
    const now = new Date();

    assertValidRoster(input.studentIds, input.type, t);
    const [hostId, ...participantIds] = input.studentIds;

    const { data: updatedSeries, error: seriesError } = await supabase
      .from("class_series")
      .update({
        student_id: hostId,
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
      .eq("coach_id", coachId)
      .select("frequency")
      .single();

    if (seriesError) {
      console.error("updateClassSeries failed:", seriesError);
      throw new Error(t("errorSaveSeries"));
    }

    const { error: deleteError } = await supabase
      .from("classes")
      .delete()
      .eq("series_id", seriesId)
      .eq("coach_id", coachId)
      .gt("start_time", formatDbTimestamp(now));

    if (deleteError) {
      console.error("updateClassSeries (clearing future instances) failed:", deleteError);
      throw new Error(t("errorSaveSeries"));
    }

    const pattern: RecurrencePattern = {
      frequency: updatedSeries.frequency,
      intervalCount: input.intervalCount,
      weekdays: input.weekdays,
      dayOfMonth: input.dayOfMonth,
    };
    // `toClubZoned(now)` here (not `now` itself) so the day-stepping below
    // reads "today" in club-local terms regardless of this server process's
    // own ambient timezone — safe because it's built and consumed entirely
    // within this one server invocation, never returned/serialized.
    const occurrences = generateOccurrences(pattern, toClubZoned(now), parseDateOnly(input.endDate)).filter(
      (day) => combineClubDateAndTime(day, input.startTime) > now,
    );

    if (occurrences.length > 0) {
      // The old future instances of this series were already deleted above,
      // so this only ever flags a genuine conflict with a DIFFERENT booking.
      for (const day of occurrences) {
        const startTime = combineClubDateAndTime(day, input.startTime);
        const endTime = addMinutes(startTime, input.durationMinutes);
        await assertWithinWorkingHours(supabase, coachId, input.locationId, startTime, endTime, t);
        await assertNoConflictForRoster(supabase, input.studentIds, startTime, endTime, t, locale);
        await assertNoCoachConflict(supabase, coachId, startTime, endTime, t, locale);
      }

      const rows = buildInstanceRows(occurrences, seriesId, coachId, hostId, input);
      const { data: insertedRows, error: insertError } = await supabase.from("classes").insert(rows).select(CLASS_COLUMNS);
      if (insertError) {
        console.error("updateClassSeries (inserting future instances) failed:", insertError);
        throw new Error(isExclusionViolation(insertError) ? t("errorTimeJustTakenSeries") : t("errorSaveSeries"));
      }

      if (participantIds.length > 0) {
        const participantRows = buildParticipantRows(insertedRows ?? [], participantIds);
        const { error: participantError } = await supabase.from("class_participants").insert(participantRows);
        if (participantError) {
          console.error("updateClassSeries participants failed:", participantError);
          await supabase
            .from("classes")
            .delete()
            .in("id", (insertedRows ?? []).map((row) => row.id));
          throw new Error(
            isExclusionViolation(participantError) ? t("errorTimeJustTakenSeries") : t("errorSaveSeries"),
          );
        }
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
      throw new Error(t("errorRefreshSeries"));
    }

    const rosterByClassId = await getParticipantsByClassId(
      supabase,
      (data ?? []).map((row) => row.id),
    );

    revalidatePath("/");
    revalidatePath("/students");
    revalidatePath("/calendar");
    return {
      ok: true,
      data: (data ?? []).map((row) =>
        mapClassRow(row, parseDbTimestamp(row.end_time) < now, rosterByClassId.get(row.id) ?? []),
      ),
    };
  } catch (e) {
    unstable_rethrow(e);
    const t = await getTranslations("classForm");
    return { ok: false, error: e instanceof Error ? e.message : t("errorSaveSeries") };
  }
}

export interface ClassSeriesMeta {
  frequency: SeriesFrequency;
  intervalCount: number;
  weekdays: number[] | null;
  dayOfMonth: number | null;
  startTime: string; // "HH:mm"
  durationMinutes: number;
  endDate: string; // "YYYY-MM-DD", club-local
}

// Lets the edit dialog lazily load the authoritative recurrence pattern
// when a coach switches to "whole series" scope, rather than guessing it
// from the single instance they clicked.
export async function getClassSeriesMeta(seriesId: string): Promise<ClassSeriesMeta> {
  const coachId = await requireCoachId();
  const t = await getTranslations("classForm");
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("class_series")
    .select("frequency, interval_count, weekdays, day_of_month, start_time, duration_minutes, end_date")
    .eq("id", seriesId)
    .eq("coach_id", coachId)
    .single();

  if (error) {
    console.error("getClassSeriesMeta failed:", error);
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

export async function updateClassInstance(
  id: string,
  input: ClassInstanceInput,
): Promise<ActionResult<ClassInstance>> {
  try {
    const coachId = await requireCoachId();
    const [t, locale] = await Promise.all([getTranslations("classForm"), getLocale()]);
    const supabase = await createClient();

    assertValidRoster(input.studentIds, input.type, t);
    const [hostId, ...participantIds] = input.studentIds;

    const { data: existingParticipants } = await supabase
      .from("class_participants")
      .select("student_id")
      .eq("class_id", id);
    const existingParticipantIds = (existingParticipants ?? []).map((row) => row.student_id);

    await assertWithinWorkingHours(supabase, coachId, input.locationId, input.startTime, input.endTime, t);
    await assertNoConflictForRoster(supabase, input.studentIds, input.startTime, input.endTime, t, locale, id);
    await assertNoCoachConflict(supabase, coachId, input.startTime, input.endTime, t, locale, id);

    const { data, error } = await supabase
      .from("classes")
      .update({
        student_id: hostId,
        location_id: input.locationId,
        class_type: input.type,
        start_time: formatDbTimestamp(input.startTime),
        end_time: formatDbTimestamp(input.endTime),
        duration_minutes: input.durationMinutes,
        is_open: input.isOpen,
        max_joiners: input.isOpen ? input.maxJoiners : null,
      })
      .eq("id", id)
      .eq("coach_id", coachId)
      .select(CLASS_COLUMNS)
      .single();

    if (error) {
      console.error("updateClassInstance failed:", error);
      throw new Error(isExclusionViolation(error) ? t("errorTimeJustTaken") : t("errorSaveClass"));
    }

    // Plain set difference against the freshly-read roster. This handles
    // host promotion/demotion for free: a participant becoming host was
    // read above but is absent from the new participant list, so it lands
    // in toRemove; the old host becoming a participant was never in
    // class_participants (it lived in classes.student_id instead), so it
    // lands in toAdd, freshly validated by the roster check above.
    const toRemove = existingParticipantIds.filter((sid) => !participantIds.includes(sid));
    const toAdd = participantIds.filter((sid) => !existingParticipantIds.includes(sid));

    if (toRemove.length > 0) {
      const { error: removeError } = await supabase
        .from("class_participants")
        .delete()
        .eq("class_id", id)
        .in("student_id", toRemove);
      if (removeError) {
        console.error("updateClassInstance (removing participants) failed:", removeError);
        throw new Error(t("errorSaveClass"));
      }
    }
    if (toAdd.length > 0) {
      const rows = toAdd.map((studentId) => ({
        class_id: id,
        student_id: studentId,
        start_time: formatDbTimestamp(input.startTime),
        end_time: formatDbTimestamp(input.endTime),
      }));
      const { error: addError } = await supabase.from("class_participants").insert(rows);
      if (addError) {
        console.error("updateClassInstance (adding participants) failed:", addError);
        throw new Error(isExclusionViolation(addError) ? t("errorTimeJustTaken") : t("errorSaveClass"));
      }
    }

    revalidatePath("/");
    revalidatePath("/students");
    revalidatePath("/calendar");
    return { ok: true, data: mapClassRow(data, false, participantIds) };
  } catch (e) {
    unstable_rethrow(e);
    const t = await getTranslations("classForm");
    return { ok: false, error: e instanceof Error ? e.message : t("errorSaveClass") };
  }
}

export async function deleteClassInstance(id: string): Promise<ActionResult> {
  try {
    const coachId = await requireCoachId();
    const t = await getTranslations("classForm");
    const supabase = await createClient();

    const { error } = await supabase.from("classes").delete().eq("id", id).eq("coach_id", coachId);

    if (error) {
      console.error("deleteClassInstance failed:", error);
      throw new Error(t("errorDeleteClassAction"));
    }

    revalidatePath("/");
    revalidatePath("/students");
    revalidatePath("/calendar");
    return { ok: true, data: undefined };
  } catch (e) {
    unstable_rethrow(e);
    const t = await getTranslations("classForm");
    return { ok: false, error: e instanceof Error ? e.message : t("errorDeleteClassAction") };
  }
}

// Deletes the recurring series and every instance it generated (past and
// future) via the class_series -> classes cascade delete.
export async function deleteClassSeries(seriesId: string): Promise<ActionResult> {
  try {
    const coachId = await requireCoachId();
    const t = await getTranslations("classForm");
    const supabase = await createClient();

    const { error } = await supabase
      .from("class_series")
      .delete()
      .eq("id", seriesId)
      .eq("coach_id", coachId);

    if (error) {
      console.error("deleteClassSeries failed:", error);
      throw new Error(t("errorDeleteSeriesAction"));
    }

    revalidatePath("/");
    revalidatePath("/students");
    revalidatePath("/calendar");
    return { ok: true, data: undefined };
  } catch (e) {
    unstable_rethrow(e);
    const t = await getTranslations("classForm");
    return { ok: false, error: e instanceof Error ? e.message : t("errorDeleteSeriesAction") };
  }
}
