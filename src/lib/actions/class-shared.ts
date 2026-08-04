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
// `studentName`, when passed, means this call is checking one of SEVERAL
// selected students (a Group/Match roster) — the rejection message must
// name exactly which one has the conflict, or the caller can't tell which
// pick to change. Omitted for the single-student Private path, which keeps
// today's unnamed message byte-for-byte unchanged.
export async function assertNoStudentConflict(
  supabase: SupabaseServerClient,
  studentId: string,
  startTime: Date,
  endTime: Date,
  t: Translator,
  locale: string,
  excludeClassId?: string,
  studentName?: string,
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
      studentName
        ? t("errorStudentConflictNamed", {
            studentName,
            coachName: conflict.coach_name,
            start: conflictStart,
            end: conflictEnd,
          })
        : t("errorStudentConflict", { coachName: conflict.coach_name, start: conflictStart, end: conflictEnd }),
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

// `hostId` — the one student stored on `classes.student_id` itself. For a
// Group/Match booking with more than one student, this is the first picked
// student; everyone else is a `class_participants` row (see
// buildParticipantRows below), never a second `classes` row.
export function buildInstanceRows(
  occurrences: Date[],
  seriesId: string,
  coachId: string,
  hostId: string,
  input: { locationId: string; type: ClassType; startTime: string; durationMinutes: number },
): SeriesInstanceRow[] {
  return occurrences.map((day) => {
    const startTime = combineClubDateAndTime(day, input.startTime);
    const endTime = addMinutes(startTime, input.durationMinutes);
    return {
      coach_id: coachId,
      student_id: hostId,
      location_id: input.locationId,
      series_id: seriesId,
      class_type: input.type,
      start_time: formatDbTimestamp(startTime),
      end_time: formatDbTimestamp(endTime),
      duration_minutes: input.durationMinutes,
    };
  });
}

export interface ParticipantRow {
  class_id: string;
  student_id: string;
  start_time: string;
  end_time: string;
}

// Fans out one class_participants row per (occurrence x participant), given
// the `classes` rows a bulk insert just returned. Correlates by start_time,
// not array index/order -- Postgres bulk-insert RETURNING order isn't
// guaranteed to match the input row order, but start_time is unique per
// occurrence within one series-creation batch.
export function buildParticipantRows(
  insertedClasses: { id: string; start_time: string; end_time: string }[],
  participantIds: string[],
): ParticipantRow[] {
  return insertedClasses.flatMap((c) =>
    participantIds.map((studentId) => ({
      class_id: c.id,
      student_id: studentId,
      start_time: c.start_time,
      end_time: c.end_time,
    })),
  );
}

// Resolves display names for a roster of student ids, used only to name the
// specific student in a conflict-rejection message (see
// errorStudentConflictNamed) -- purely cosmetic, never used for
// authorization. Only called when there's more than one student to check,
// so the common single-student Private path does zero extra round trips.
export async function getStudentDisplayNames(
  supabase: SupabaseServerClient,
  studentIds: string[],
): Promise<Map<string, string>> {
  const { data, error } = await supabase.rpc("get_student_display_names", { p_ids: studentIds });
  if (error) {
    console.error("get_student_display_names failed:", error);
    return new Map();
  }
  return new Map((data ?? []).map((row: { id: string; name: string }) => [row.id, row.name]));
}

// Batched lookup of every class_participants row for a set of class ids,
// grouped by class_id -- one query instead of N, shared by both action
// files' update paths and by the query layer's list/calendar reads.
export async function getParticipantsByClassId(
  supabase: SupabaseServerClient,
  classIds: string[],
): Promise<Map<string, string[]>> {
  const rosterByClassId = new Map<string, string[]>();
  if (classIds.length === 0) return rosterByClassId;

  const { data, error } = await supabase
    .from("class_participants")
    .select("class_id, student_id")
    .in("class_id", classIds);

  if (error) {
    console.error("getParticipantsByClassId failed:", error);
    return rosterByClassId;
  }

  for (const row of data ?? []) {
    rosterByClassId.set(row.class_id, [...(rosterByClassId.get(row.class_id) ?? []), row.student_id]);
  }
  return rosterByClassId;
}

// Shared roster validation, called before any write on both the coach and
// student side. `studentIds` is the FULL roster (host + participants).
export function assertValidRoster(studentIds: string[], type: ClassType, t: Translator): void {
  if (studentIds.length === 0) {
    throw new Error(t("errorSelectStudents"));
  }
  if (new Set(studentIds).size !== studentIds.length) {
    throw new Error(t("errorDuplicateStudent"));
  }
  if (studentIds.length > 8) {
    throw new Error(t("errorTooManyStudents"));
  }
  if (type === "Private" && studentIds.length > 1) {
    throw new Error(t("errorPrivateSingleStudent"));
  }
}
