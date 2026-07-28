import { addMinutes, combineClubDateAndTime, formatClubDate, formatDbTimestamp, parseDbTimestamp } from "@/lib/dates";
import { createClient } from "@/lib/supabase/server";
import type { ClassType } from "@/lib/mock-data";

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

// This student is shared club-wide, so an overlap can come from a
// DIFFERENT coach's booking — a plain per-coach query can never see that
// (RLS scopes it out). `check_student_conflict` is a SECURITY DEFINER RPC
// that looks across all coaches for exactly this one check. A DB-level
// exclusion constraint on `classes` is the real guarantee against races;
// this call just turns that into a specific, friendly message ahead of time.
export async function assertNoStudentConflict(
  supabase: SupabaseServerClient,
  studentId: string,
  startTime: Date,
  endTime: Date,
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
    throw new Error("Couldn't verify the student's schedule. Try again.");
  }

  const conflict = data?.[0];
  if (conflict) {
    const conflictStart = formatClubDate(parseDbTimestamp(conflict.start_time), "MMM d, h:mm a");
    const conflictEnd = formatClubDate(parseDbTimestamp(conflict.end_time), "h:mm a");
    throw new Error(
      `This student is already booked with ${conflict.coach_name} from ${conflictStart} to ${conflictEnd}. Pick a different time or student.`,
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
    throw new Error("Couldn't verify the coach's schedule. Try again.");
  }

  const conflict = data?.[0];
  if (conflict) {
    const conflictStart = formatClubDate(parseDbTimestamp(conflict.start_time), "MMM d, h:mm a");
    const conflictEnd = formatClubDate(parseDbTimestamp(conflict.end_time), "h:mm a");
    throw new Error(
      `This coach is already booked with ${conflict.student_name} from ${conflictStart} to ${conflictEnd}. Pick a different time or coach.`,
    );
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
