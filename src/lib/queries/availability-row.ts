import { parseDbTimestamp } from "@/lib/dates";
import type { AvailabilityBlock } from "@/lib/mock-data";

export const AVAILABILITY_BLOCK_COLUMNS =
  "id, coach_id, series_id, location_ids, start_time, end_time" as const;

export interface AvailabilityBlockRow {
  id: string;
  coach_id: string;
  series_id: string | null;
  location_ids: string[];
  start_time: string;
  end_time: string;
}

export function mapAvailabilityBlockRow(row: AvailabilityBlockRow): AvailabilityBlock {
  return {
    id: row.id,
    coachId: row.coach_id,
    seriesId: row.series_id,
    locationIds: row.location_ids,
    startTime: parseDbTimestamp(row.start_time),
    endTime: parseDbTimestamp(row.end_time),
  };
}
