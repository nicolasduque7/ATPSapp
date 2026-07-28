import { parseDbTimestamp } from "@/lib/dates";
import type { ClassInstance, ClassType } from "@/lib/mock-data";

export const CLASS_COLUMNS =
  "id, coach_id, student_id, location_id, series_id, class_type, start_time, end_time, duration_minutes, notes, is_open, max_joiners" as const;

export interface ClassRow {
  id: string;
  coach_id: string;
  student_id: string;
  location_id: string;
  series_id: string | null;
  class_type: ClassType;
  start_time: string;
  end_time: string;
  duration_minutes: number;
  notes: string | null;
  is_open: boolean;
  max_joiners: number | null;
}

export function mapClassRow(row: ClassRow, completed = false): ClassInstance {
  return {
    id: row.id,
    coachId: row.coach_id,
    studentId: row.student_id,
    locationId: row.location_id,
    seriesId: row.series_id,
    type: row.class_type,
    startTime: parseDbTimestamp(row.start_time),
    endTime: parseDbTimestamp(row.end_time),
    durationMinutes: row.duration_minutes,
    completed,
    notes: row.notes ?? undefined,
    isOpen: row.is_open,
    maxJoiners: row.max_joiners,
  };
}
