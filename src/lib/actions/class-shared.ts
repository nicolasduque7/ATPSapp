import type { getTranslations } from "next-intl/server";

import {
  addDays,
  addMinutes,
  combineClubDateAndTime,
  formatClubDate,
  formatDbTimestamp,
  isFullyWithinWindows,
  parseDbTimestamp,
  startOfClubDay,
  type TimeWindow,
} from "@/lib/dates";
import { getDateFnsLocale } from "@/lib/date-locale";
import { createClient } from "@/lib/supabase/server";
import type { ClassType } from "@/lib/mock-data";

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;
type Translator = Awaited<ReturnType<typeof getTranslations>>;

// This student is shared club-wide, so an overlap can come from a
// DIFFERENT coach's booking — a plain per-coach query can never see that
// (RLS scopes it out). `check_student_conflict` is a SECURITY DEFINER RPC
// that looks across all coaches for exactly this one check. A DB-level
// exclusion constraint on `classes` is the real guarantee against races;
// this call just turns that into a specific, friendly message ahead of time.
//
// `t`/`locale` are resolved once per calling action (via getTranslations()/
// getLocale(), which read the same NEXT_LOCALE cookie the language toggle
// sets) and threaded in here rather than re-resolved per call, so the
// message this throws is built in the user's own language instead of being
// hardcoded English — the fix for a real bug where server-thrown errors
// always displayed in English regardless of the app's locale.
export async function assertNoStudentConflict(
  supabase: SupabaseServerClient,
  studentId: string,
  startTime: Date,
  endTime: Date,
  t: Translator,
  locale: string,
  excludeClassId?: string,
): Promise<void> {
  const { data, error } = await supabase.rpc("check_student_conflict", {
    p_student_id: studentId,
    p_start_time: formatDbTimestamp(startTime),
    p_end_time: formatDbTimestamp(endTime),
    p_exclude_class_id: excludeClassId ?? null,
  });

  if (error) {
    console.error("check_student_conflict failed:", error);
    throw new Error(t("errorCheckStudentSchedule"));
  }

  const conflict = data?.[0];
  if (conflict) {
    const dateFnsLocale = getDateFnsLocale(locale);
    const conflictStart = formatClubDate(parseDbTimestamp(conflict.start_time), "MMM d, h:mm a", dateFnsLocale);
    const conflictEnd = formatClubDate(parseDbTimestamp(conflict.end_time), "h:mm a", dateFnsLocale);
    throw new Error(
      t("errorStudentConflict", { coachName: conflict.coach_name, start: conflictStart, end: conflictEnd }),
    );
  }
}

// Symmetric check on the coach side: nothing stops a coach being double
// booked across two different students, which becomes a real risk once
// students can each independently pick any coach and self-book (a coach
// could always accidentally double-book themselves manually too).
export async function assertNoCoachConflict(
  supabase: SupabaseServerClient,
  coachId: string,
  startTime: Date,
  endTime: Date,
  t: Translator,
  locale: string,
  excludeClassId?: string,
): Promise<void> {
  const { data, error } = await supabase.rpc("check_coach_conflict", {
    p_coach_id: coachId,
    p_start_time: formatDbTimestamp(startTime),
    p_end_time: formatDbTimestamp(endTime),
    p_exclude_class_id: excludeClassId ?? null,
  });

  if (error) {
    console.error("check_coach_conflict failed:", error);
    throw new Error(t("errorCheckCoachSchedule"));
  }

  const conflict = data?.[0];
  if (conflict) {
    const dateFnsLocale = getDateFnsLocale(locale);
    const conflictStart = formatClubDate(parseDbTimestamp(conflict.start_time), "MMM d, h:mm a", dateFnsLocale);
    const conflictEnd = formatClubDate(parseDbTimestamp(conflict.end_time), "h:mm a", dateFnsLocale);
    throw new Error(
      t("errorCoachConflict", { studentName: conflict.student_name, start: conflictStart, end: conflictEnd }),
    );
  }
}

// Working hours are enforced unconditionally — no carve-out for a coach
// with no/partial declared hours (verified against prod: all real coaches
// already have hours declared). Unlike the conflict checks above, this
// takes no exclude-id: declared hours are a property of the coach/location/
// day, not of any specific class row, so editing a class never changes what
// "the coach's declared hours" are. Shares `isFullyWithinWindows` with the
// suggestion panel's own free-window computation (src/lib/dates.ts) so a
// slot the panel suggests can never be rejected here, and a slot it doesn't
// suggest can never be accepted.
export async function assertWithinWorkingHours(
  supabase: SupabaseServerClient,
  coachId: string,
  locationId: string,
  startTime: Date,
  endTime: Date,
  t: Translator,
): Promise<void> {
  const dayStart = startOfClubDay(startTime);
  const dayEnd = addDays(dayStart, 1);

  const { data, error } = await supabase
    .from("coach_availability_blocks")
    .select("start_time, end_time")
    .eq("coach_id", coachId)
    .contains("location_ids", [locationId])
    .gte("start_time", formatDbTimestamp(dayStart))
    .lt("start_time", formatDbTimestamp(dayEnd));

  if (error) {
    console.error("assertWithinWorkingHours failed:", error);
    throw new Error(t("errorCheckWorkingHours"));
  }

  const windows: TimeWindow[] = (data ?? []).map((block) => ({
    start: parseDbTimestamp(block.start_time),
    end: parseDbTimestamp(block.end_time),
  }));

  if (!isFullyWithinWindows({ start: startTime, end: endTime }, windows)) {
    throw new Error(t("errorOutsideWorkingHours"));
  }
}

// Backstop for the rare case where two writers submit at the same instant:
// the DB exclusion constraints (not the checks above) are what actually
// block the second write, surfaced as Postgres error code 23P01.
export function isExclusionViolation(error: { code?: string }): boolean {
  return error.code === "23P01";
}

export interface SeriesInstanceRow {
  coach_id: string;
  student_id: string;
  location_id: string;
  series_id: string;
  class_type: ClassType;
  start_time: string;
  end_time: string;
  duration_minutes: number;
}

export function buildInstanceRows(
  occurrences: Date[],
  seriesId: string,
  coachId: string,
  studentId: string,
  input: { locationId: string; type: ClassType; startTime: string; durationMinutes: number },
): SeriesInstanceRow[] {
  return occurrences.map((day) => {
    const startTime = combineClubDateAndTime(day, input.startTime);
    const endTime = addMinutes(startTime, input.durationMinutes);
    return {
      coach_id: coachId,
      student_id: studentId,
      location_id: input.locationId,
      series_id: seriesId,
      class_type: input.type,
      start_time: formatDbTimestamp(startTime),
      end_time: formatDbTimestamp(endTime),
      duration_minutes: input.durationMinutes,
    };
  });
}
