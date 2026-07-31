"use server";

import { revalidatePath } from "next/cache";
import { unstable_rethrow } from "next/navigation";

import { requireCoachId } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import {
  combineClubDateAndTime,
  formatDbTimestamp,
  generateOccurrences,
  parseDateOnly,
  toClubZoned,
  type RecurrencePattern,
  type SeriesFrequency,
} from "@/lib/dates";
import type { AvailabilityBlock } from "@/lib/mock-data";
import { mapAvailabilityBlockRow, AVAILABILITY_BLOCK_COLUMNS } from "@/lib/queries/availability-row";
import type { ActionResult } from "@/lib/actions/result";

export interface AvailabilityBlockInput {
  locationIds: string[];
  startTime: Date;
  endTime: Date;
}

export interface AvailabilitySeriesInput {
  locationIds: string[];
  frequency: SeriesFrequency;
  intervalCount: number;
  weekdays?: number[] | null; // required (non-empty) when frequency === "Weekly"
  dayOfMonth?: number | null; // required when frequency === "Monthly", 1-30
  startDate: string; // "YYYY-MM-DD", club-local
  startTime: string; // "HH:mm"
  endTime: string; // "HH:mm"
  endDate: string; // "YYYY-MM-DD", club-local
}

// Frequency is intentionally absent — it's locked at creation, same as
// class series. The action re-reads it from the DB after updating.
export interface AvailabilitySeriesUpdateInput {
  locationIds: string[];
  intervalCount: number;
  weekdays?: number[] | null;
  dayOfMonth?: number | null;
  startTime: string; // "HH:mm"
  endTime: string; // "HH:mm"
  endDate: string; // "YYYY-MM-DD", club-local
}

interface SeriesBlockRow {
  coach_id: string;
  series_id: string;
  location_ids: string[];
  start_time: string;
  end_time: string;
}

function buildBlockRows(
  occurrences: Date[],
  seriesId: string,
  coachId: string,
  input: Pick<AvailabilitySeriesInput, "locationIds" | "startTime" | "endTime">,
): SeriesBlockRow[] {
  return occurrences.map((day) => ({
    coach_id: coachId,
    series_id: seriesId,
    location_ids: input.locationIds,
    start_time: formatDbTimestamp(combineClubDateAndTime(day, input.startTime)),
    end_time: formatDbTimestamp(combineClubDateAndTime(day, input.endTime)),
  }));
}

function revalidateAvailabilityPaths(): void {
  revalidatePath("/settings");
  revalidatePath("/calendar");
}

export async function createAvailabilityBlock(
  input: AvailabilityBlockInput,
): Promise<ActionResult<AvailabilityBlock>> {
  try {
    const coachId = await requireCoachId();
    const supabase = await createClient();

    if (input.endTime <= input.startTime) {
      throw new Error("End time must be after the start time.");
    }
    if (input.locationIds.length === 0) {
      throw new Error("Select at least one location.");
    }

    const { data, error } = await supabase
      .from("coach_availability_blocks")
      .insert({
        coach_id: coachId,
        location_ids: input.locationIds,
        start_time: formatDbTimestamp(input.startTime),
        end_time: formatDbTimestamp(input.endTime),
      })
      .select(AVAILABILITY_BLOCK_COLUMNS)
      .single();

    if (error) {
      console.error("createAvailabilityBlock failed:", error);
      throw new Error("Couldn't create the working hours. Try again.");
    }

    revalidateAvailabilityPaths();
    return { ok: true, data: mapAvailabilityBlockRow(data) };
  } catch (e) {
    unstable_rethrow(e);
    return { ok: false, error: e instanceof Error ? e.message : "Couldn't create the working hours. Try again." };
  }
}

export interface CreatedAvailabilitySeries {
  seriesId: string;
  blocks: AvailabilityBlock[];
}

// Returns the new series' id alongside its blocks (unlike createClassSeries)
// because the Settings page lists recurring rules directly, not just their
// materialized instances, and needs the id to add the new rule to that list.
export async function createAvailabilitySeries(
  input: AvailabilitySeriesInput,
): Promise<ActionResult<CreatedAvailabilitySeries>> {
  try {
    const coachId = await requireCoachId();
    const supabase = await createClient();

    if (input.locationIds.length === 0) {
      throw new Error("Select at least one location.");
    }
    if (input.endDate < input.startDate) {
      throw new Error("Until date must be on or after the start date.");
    }
    if (input.endTime <= input.startTime) {
      throw new Error("End time must be after the start time.");
    }
    if (input.frequency === "Weekly" && !input.weekdays?.length) {
      throw new Error("Select at least one day of the week.");
    }
    if (input.frequency === "Monthly" && !input.dayOfMonth) {
      throw new Error("Select a day of the month.");
    }

    const pattern: RecurrencePattern = {
      frequency: input.frequency,
      intervalCount: input.intervalCount,
      weekdays: input.frequency === "Weekly" ? input.weekdays : null,
      dayOfMonth: input.frequency === "Monthly" ? input.dayOfMonth : null,
    };
    const occurrences = generateOccurrences(pattern, parseDateOnly(input.startDate), parseDateOnly(input.endDate));
    if (occurrences.length === 0) {
      throw new Error("Until date must be on or after the start date.");
    }

    const { data: series, error: seriesError } = await supabase
      .from("coach_availability_series")
      .insert({
        coach_id: coachId,
        frequency: input.frequency,
        interval_count: input.intervalCount,
        weekdays: pattern.weekdays,
        day_of_month: pattern.dayOfMonth,
        start_time: `${input.startTime}:00`,
        end_time: `${input.endTime}:00`,
        location_ids: input.locationIds,
        start_date: input.startDate,
        end_date: input.endDate,
      })
      .select("id")
      .single();

    if (seriesError) {
      console.error("createAvailabilitySeries failed:", seriesError);
      throw new Error("Couldn't create the recurring working hours. Try again.");
    }

    const rows = buildBlockRows(occurrences, series.id, coachId, input);
    const { data, error } = await supabase
      .from("coach_availability_blocks")
      .insert(rows)
      .select(AVAILABILITY_BLOCK_COLUMNS);

    if (error) {
      console.error("createAvailabilitySeries blocks failed:", error);
      await supabase.from("coach_availability_series").delete().eq("id", series.id);
      throw new Error("Couldn't create the recurring working hours. Try again.");
    }

    revalidateAvailabilityPaths();
    return { ok: true, data: { seriesId: series.id, blocks: (data ?? []).map(mapAvailabilityBlockRow) } };
  } catch (e) {
    unstable_rethrow(e);
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Couldn't create the recurring working hours. Try again.",
    };
  }
}

// Updates the series definition and regenerates its future (not-yet-started)
// blocks to match; past blocks are left untouched — same "edit whole series"
// shape as updateClassSeries.
export async function updateAvailabilitySeries(
  seriesId: string,
  input: AvailabilitySeriesUpdateInput,
): Promise<ActionResult<AvailabilityBlock[]>> {
  try {
    const coachId = await requireCoachId();
    const supabase = await createClient();
    const now = new Date();

    if (input.locationIds.length === 0) {
      throw new Error("Select at least one location.");
    }
    if (input.endTime <= input.startTime) {
      throw new Error("End time must be after the start time.");
    }

    const { data: updatedSeries, error: seriesError } = await supabase
      .from("coach_availability_series")
      .update({
        interval_count: input.intervalCount,
        weekdays: input.weekdays ?? null,
        day_of_month: input.dayOfMonth ?? null,
        start_time: `${input.startTime}:00`,
        end_time: `${input.endTime}:00`,
        location_ids: input.locationIds,
        end_date: input.endDate,
      })
      .eq("id", seriesId)
      .eq("coach_id", coachId)
      .select("frequency")
      .single();

    if (seriesError) {
      console.error("updateAvailabilitySeries failed:", seriesError);
      throw new Error("Couldn't save the working hours. Try again.");
    }

    const { error: deleteError } = await supabase
      .from("coach_availability_blocks")
      .delete()
      .eq("series_id", seriesId)
      .eq("coach_id", coachId)
      .gt("start_time", formatDbTimestamp(now));

    if (deleteError) {
      console.error("updateAvailabilitySeries (clearing future blocks) failed:", deleteError);
      throw new Error("Couldn't save the working hours. Try again.");
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
      const rows = buildBlockRows(occurrences, seriesId, coachId, input);
      const { error: insertError } = await supabase.from("coach_availability_blocks").insert(rows);
      if (insertError) {
        console.error("updateAvailabilitySeries (inserting future blocks) failed:", insertError);
        throw new Error("Couldn't save the working hours. Try again.");
      }
    }

    const { data, error } = await supabase
      .from("coach_availability_blocks")
      .select(AVAILABILITY_BLOCK_COLUMNS)
      .eq("series_id", seriesId)
      .eq("coach_id", coachId)
      .order("start_time");

    if (error) {
      console.error("updateAvailabilitySeries (refetch) failed:", error);
      throw new Error("Couldn't refresh the working hours. Try again.");
    }

    revalidateAvailabilityPaths();
    return { ok: true, data: (data ?? []).map(mapAvailabilityBlockRow) };
  } catch (e) {
    unstable_rethrow(e);
    return { ok: false, error: e instanceof Error ? e.message : "Couldn't save the working hours. Try again." };
  }
}

export interface AvailabilitySeriesMeta {
  frequency: SeriesFrequency;
  intervalCount: number;
  weekdays: number[] | null;
  dayOfMonth: number | null;
  startTime: string; // "HH:mm"
  endTime: string; // "HH:mm"
  locationIds: string[];
  endDate: string; // "YYYY-MM-DD", club-local
}

// Lets the Calendar's edit dialog lazily load the authoritative recurrence
// pattern when a coach clicks one of their own materialized blocks and
// switches to "whole series" scope, rather than guessing it from that one
// block. Mirrors getClassSeriesMeta. Scoped to the caller's own series (the
// Calendar only ever opens this for the viewer's own coachId).
export async function getAvailabilitySeriesMeta(seriesId: string): Promise<AvailabilitySeriesMeta> {
  const coachId = await requireCoachId();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("coach_availability_series")
    .select("frequency, interval_count, weekdays, day_of_month, start_time, end_time, location_ids, end_date")
    .eq("id", seriesId)
    .eq("coach_id", coachId)
    .single();

  if (error) {
    console.error("getAvailabilitySeriesMeta failed:", error);
    throw new Error("Couldn't load the working hours. Try again.");
  }

  return {
    frequency: data.frequency,
    intervalCount: data.interval_count,
    weekdays: data.weekdays,
    dayOfMonth: data.day_of_month,
    startTime: data.start_time.slice(0, 5),
    endTime: data.end_time.slice(0, 5),
    locationIds: data.location_ids,
    endDate: data.end_date,
  };
}

export async function updateAvailabilityBlock(
  id: string,
  input: AvailabilityBlockInput,
): Promise<ActionResult<AvailabilityBlock>> {
  try {
    const coachId = await requireCoachId();
    const supabase = await createClient();

    if (input.endTime <= input.startTime) {
      throw new Error("End time must be after the start time.");
    }
    if (input.locationIds.length === 0) {
      throw new Error("Select at least one location.");
    }

    const { data, error } = await supabase
      .from("coach_availability_blocks")
      .update({
        location_ids: input.locationIds,
        start_time: formatDbTimestamp(input.startTime),
        end_time: formatDbTimestamp(input.endTime),
      })
      .eq("id", id)
      .eq("coach_id", coachId)
      .select(AVAILABILITY_BLOCK_COLUMNS)
      .single();

    if (error) {
      console.error("updateAvailabilityBlock failed:", error);
      throw new Error("Couldn't save the working hours. Try again.");
    }

    revalidateAvailabilityPaths();
    return { ok: true, data: mapAvailabilityBlockRow(data) };
  } catch (e) {
    unstable_rethrow(e);
    return { ok: false, error: e instanceof Error ? e.message : "Couldn't save the working hours. Try again." };
  }
}

export async function deleteAvailabilityBlock(id: string): Promise<ActionResult> {
  try {
    const coachId = await requireCoachId();
    const supabase = await createClient();

    const { error } = await supabase
      .from("coach_availability_blocks")
      .delete()
      .eq("id", id)
      .eq("coach_id", coachId);

    if (error) {
      console.error("deleteAvailabilityBlock failed:", error);
      throw new Error("Couldn't delete the working hours. Try again.");
    }

    revalidateAvailabilityPaths();
    return { ok: true, data: undefined };
  } catch (e) {
    unstable_rethrow(e);
    return { ok: false, error: e instanceof Error ? e.message : "Couldn't delete the working hours. Try again." };
  }
}

// Deletes the recurring series and every block it generated (past and
// future) via the coach_availability_series -> coach_availability_blocks
// cascade delete.
export async function deleteAvailabilitySeries(seriesId: string): Promise<ActionResult> {
  try {
    const coachId = await requireCoachId();
    const supabase = await createClient();

    const { error } = await supabase
      .from("coach_availability_series")
      .delete()
      .eq("id", seriesId)
      .eq("coach_id", coachId);

    if (error) {
      console.error("deleteAvailabilitySeries failed:", error);
      throw new Error("Couldn't delete the working hours. Try again.");
    }

    revalidateAvailabilityPaths();
    return { ok: true, data: undefined };
  } catch (e) {
    unstable_rethrow(e);
    return { ok: false, error: e instanceof Error ? e.message : "Couldn't delete the working hours. Try again." };
  }
}
