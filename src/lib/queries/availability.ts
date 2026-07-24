import { requireCoachId } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { parseDateOnly, type SeriesFrequency } from "@/lib/dates";
import type { AvailabilityBlock } from "@/lib/mock-data";
import { mapAvailabilityBlockRow, AVAILABILITY_BLOCK_COLUMNS } from "@/lib/queries/availability-row";

// Every coach's working-hours blocks club-wide, for the Calendar's
// cross-coach visibility toggle. Relies on the shared select RLS policy.
export async function getAllAvailabilityBlocks(): Promise<AvailabilityBlock[]> {
  await requireCoachId();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("coach_availability_blocks")
    .select(AVAILABILITY_BLOCK_COLUMNS)
    .order("start_time");

  if (error) {
    console.error("getAllAvailabilityBlocks failed:", error);
    throw new Error("Couldn't load working hours. Try again.");
  }

  return (data ?? []).map(mapAvailabilityBlockRow);
}

// Own blocks only, explicitly filtered — used by the Settings page's
// own-management view. Only ever returns one-off blocks (series_id null) in
// practice for that view; recurring entries are managed via the series
// summary below instead.
export async function getCoachAvailabilityBlocks(): Promise<AvailabilityBlock[]> {
  const coachId = await requireCoachId();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("coach_availability_blocks")
    .select(AVAILABILITY_BLOCK_COLUMNS)
    .eq("coach_id", coachId)
    .order("start_time");

  if (error) {
    console.error("getCoachAvailabilityBlocks failed:", error);
    throw new Error("Couldn't load your working hours. Try again.");
  }

  return (data ?? []).map(mapAvailabilityBlockRow);
}

export interface AvailabilitySeriesSummary {
  id: string;
  frequency: SeriesFrequency;
  intervalCount: number;
  weekdays: number[] | null;
  dayOfMonth: number | null;
  startTime: string; // "HH:mm"
  endTime: string; // "HH:mm"
  locationIds: string[];
  startDate: Date;
  endDate: Date;
}

// The coach's own recurring working-hours rules, for the Settings page's
// list — the Settings page manages rules directly (not per-instance), so
// this (not getCoachAvailabilityBlocks) is what drives that list's cadence
// summaries and edit dialog.
export async function getCoachAvailabilitySeries(): Promise<AvailabilitySeriesSummary[]> {
  const coachId = await requireCoachId();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("coach_availability_series")
    .select(
      "id, frequency, interval_count, weekdays, day_of_month, start_time, end_time, location_ids, start_date, end_date",
    )
    .eq("coach_id", coachId)
    .order("start_date");

  if (error) {
    console.error("getCoachAvailabilitySeries failed:", error);
    throw new Error("Couldn't load your working hours. Try again.");
  }

  return (data ?? []).map((row) => ({
    id: row.id,
    frequency: row.frequency,
    intervalCount: row.interval_count,
    weekdays: row.weekdays,
    dayOfMonth: row.day_of_month,
    startTime: row.start_time.slice(0, 5),
    endTime: row.end_time.slice(0, 5),
    locationIds: row.location_ids,
    startDate: parseDateOnly(row.start_date),
    endDate: parseDateOnly(row.end_date),
  }));
}
