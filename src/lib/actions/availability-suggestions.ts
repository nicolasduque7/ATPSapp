"use server";

import { redirect, unstable_rethrow } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { requireStudent } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import {
  addDays,
  addMinutes,
  combineClubDateAndTime,
  formatClubDate,
  formatDateOnly,
  formatDbTimestamp,
  parseDateOnly,
  parseDbTimestamp,
  subtractBusyIntervals,
  type TimeWindow,
} from "@/lib/dates";
import { AVAILABILITY_BLOCK_COLUMNS } from "@/lib/queries/availability-row";
import type { ActionResult } from "@/lib/actions/result";

export interface DayAvailability {
  date: string; // "YYYY-MM-DD", club-local
  freeWindows: { startTime: string; endTime: string }[]; // "HH:mm" pairs, that day
}

// Neither role needs protecting from the other here — a coach's declared
// hours minus their busy times isn't sensitive to which authenticated role
// is asking (mirrors check_coach_conflict's own no-caller-identity-guard
// reasoning), and this same action now backs the suggestion panel in both
// the coach's and the student's booking dialogs. Just requires *some*
// signed-in user, unlike requireStudent()/requireCoach() which also assert
// a specific role.
async function requireAuthenticated(): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login");
  }
}

// One coach's actual open time, per day, over a lookahead window: their
// declared working-hours blocks (already readable directly by both coaches
// and students) minus their existing bookings (read via the SECURITY
// DEFINER get_coach_busy_intervals, since neither role can otherwise see
// another coach's/student's `classes` rows — same RLS wall
// check_coach_conflict exists to get around). See BACKEND.md section 15.
//
// `excludeClassId`/`excludeSeriesId` matter only when suggesting slots for
// a class currently being EDITED: without them, the class's own existing
// booking would count as "busy" against itself, incorrectly hiding its own
// current time from the suggestions.
export async function getAvailableSlotSuggestions(
  coachId: string,
  locationId: string,
  fromDate: string,
  days: number = 14,
  excludeClassId?: string,
  excludeSeriesId?: string,
): Promise<ActionResult<DayAvailability[]>> {
  try {
    await requireAuthenticated();
    const t = await getTranslations("availableSlots");
    const supabase = await createClient();

    const fromDay = parseDateOnly(fromDate);
    const toDay = addDays(fromDay, days);
    const fromInstant = combineClubDateAndTime(fromDay, "00:00");
    const toInstant = combineClubDateAndTime(toDay, "00:00");

    const [{ data: blocks, error: blocksError }, { data: busyRows, error: busyError }] = await Promise.all([
      supabase
        .from("coach_availability_blocks")
        .select(AVAILABILITY_BLOCK_COLUMNS)
        .eq("coach_id", coachId)
        .contains("location_ids", [locationId])
        .gte("start_time", formatDbTimestamp(fromInstant))
        .lt("start_time", formatDbTimestamp(toInstant)),
      supabase.rpc("get_coach_busy_intervals", {
        p_coach_id: coachId,
        p_from: formatDbTimestamp(fromInstant),
        p_to: formatDbTimestamp(toInstant),
        p_exclude_class_id: excludeClassId ?? null,
        p_exclude_series_id: excludeSeriesId ?? null,
      }),
    ]);

    if (blocksError) {
      console.error("getAvailableSlotSuggestions (blocks) failed:", blocksError);
      throw new Error(t("errorLoadWorkingHours"));
    }
    if (busyError) {
      console.error("getAvailableSlotSuggestions (busy) failed:", busyError);
      throw new Error(t("errorCheckSchedule"));
    }

    const windowsByDay = new Map<string, TimeWindow[]>();
    for (const block of blocks ?? []) {
      const start = parseDbTimestamp(block.start_time);
      const end = parseDbTimestamp(block.end_time);
      const key = formatClubDate(start, "yyyy-MM-dd");
      const list = windowsByDay.get(key) ?? [];
      list.push({ start, end });
      windowsByDay.set(key, list);
    }

    const busyByDay = new Map<string, TimeWindow[]>();
    for (const row of busyRows ?? []) {
      const start = parseDbTimestamp(row.start_time);
      const end = parseDbTimestamp(row.end_time);
      const key = formatClubDate(start, "yyyy-MM-dd");
      const list = busyByDay.get(key) ?? [];
      list.push({ start, end });
      busyByDay.set(key, list);
    }

    const result: DayAvailability[] = [];
    for (let i = 0; i < days; i++) {
      const key = formatDateOnly(addDays(fromDay, i));
      const free = subtractBusyIntervals(windowsByDay.get(key) ?? [], busyByDay.get(key) ?? []);
      result.push({
        date: key,
        freeWindows: free.map((window) => ({
          startTime: formatClubDate(window.start, "HH:mm"),
          endTime: formatClubDate(window.end, "HH:mm"),
        })),
      });
    }

    return { ok: true, data: result };
  } catch (e) {
    unstable_rethrow(e);
    const t = await getTranslations("availableSlots");
    return { ok: false, error: e instanceof Error ? e.message : t("errorLoadSlots") };
  }
}

export interface SeriesConflictPreview {
  conflictDates: string[]; // "YYYY-MM-DD", club-local — occurrences that would conflict
  total: number;
}

// A recurring series applies one fixed time-of-day across every generated
// occurrence, so "is this pattern actually free" is a whole-series question,
// not a single-day one. Bulk-checks every occurrence in one round trip
// instead of looping the single-occurrence conflict checks from the client.
// Advisory only — does not change createStudentClassSeries's own submit-time
// validation, which still runs its existing sequential per-occurrence check
// and aborts the whole series on the first real conflict.
export async function checkSeriesConflictsPreview(
  coachId: string,
  occurrences: Date[],
  startTime: string,
  durationMinutes: number,
): Promise<ActionResult<SeriesConflictPreview>> {
  try {
    const { studentId } = await requireStudent();
    const t = await getTranslations("availableSlots");
    const supabase = await createClient();

    if (occurrences.length === 0) {
      return { ok: true, data: { conflictDates: [], total: 0 } };
    }

    const starts: string[] = [];
    const ends: string[] = [];
    for (const day of occurrences) {
      const start = combineClubDateAndTime(day, startTime);
      const end = addMinutes(start, durationMinutes);
      starts.push(formatDbTimestamp(start));
      ends.push(formatDbTimestamp(end));
    }

    const { data, error } = await supabase.rpc("check_series_conflicts_bulk", {
      p_student_id: studentId,
      p_coach_id: coachId,
      p_starts: starts,
      p_ends: ends,
    });

    if (error) {
      console.error("checkSeriesConflictsPreview failed:", error);
      throw new Error(t("errorCheckSessions"));
    }

    const conflictDates = (data ?? [])
      .filter((row: { occurrence_index: number; has_conflict: boolean }) => row.has_conflict)
      .map((row: { occurrence_index: number; has_conflict: boolean }) => formatDateOnly(occurrences[row.occurrence_index]));

    return { ok: true, data: { conflictDates, total: occurrences.length } };
  } catch (e) {
    unstable_rethrow(e);
    const t = await getTranslations("availableSlots");
    return {
      ok: false,
      error: e instanceof Error ? e.message : t("errorCheckSessions"),
    };
  }
}
