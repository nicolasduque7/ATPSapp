import type { ClassInstance, ClassType } from "@/lib/mock-data";

export const CLASS_COLUMNS =
  "id, student_id, location_id, series_id, class_type, start_time, end_time, duration_minutes, notes" as const;

export interface ClassRow {
  id: string;
  student_id: string;
  location_id: string;
  series_id: string | null;
  class_type: ClassType;
  start_time: string;
  end_time: string;
  duration_minutes: number;
  notes: string | null;
}

export function mapClassRow(row: ClassRow, completed = false): ClassInstance {
  return {
    id: row.id,
    studentId: row.student_id,
    locationId: row.location_id,
    seriesId: row.series_id,
    type: row.class_type,
    startTime: new Date(row.start_time),
    endTime: new Date(row.end_time),
    durationMinutes: row.duration_minutes,
    completed,
    notes: row.notes ?? undefined,
  };
}
