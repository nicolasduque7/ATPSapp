"use server";

import { revalidatePath } from "next/cache";
import { unstable_rethrow } from "next/navigation";

import { requireCoachId } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { CourtSurface, Location } from "@/lib/mock-data";
import { mapLocationRow, LOCATION_COLUMNS } from "@/lib/queries/location-row";
import type { ActionResult } from "@/lib/actions/result";

export interface LocationInput {
  name: string;
  address?: string;
  surface: CourtSurface;
  hardCourts: number;
  clayCourts: number;
}

export async function createLocation(input: LocationInput): Promise<ActionResult<Location>> {
  try {
    const coachId = await requireCoachId();
    const supabase = await createClient();

    const { data, error } = await supabase
      .from("locations")
      .insert({
        coach_id: coachId,
        name: input.name,
        address: input.address ?? null,
        surface: input.surface,
        hard_courts: input.hardCourts,
        clay_courts: input.clayCourts,
      })
      .select(LOCATION_COLUMNS)
      .single();

    if (error) {
      console.error("createLocation failed:", error);
      throw new Error("Couldn't create location. Try again.");
    }

    revalidatePath("/locations");
    return { ok: true, data: mapLocationRow(data) };
  } catch (e) {
    unstable_rethrow(e);
    return { ok: false, error: e instanceof Error ? e.message : "Couldn't create location. Try again." };
  }
}

export async function updateLocation(id: string, input: LocationInput): Promise<ActionResult<Location>> {
  try {
    await requireCoachId();
    const supabase = await createClient();

    // Locations are a shared, club-wide list — any signed-in coach may edit
    // any location, not just the one who originally added it.
    const { data, error } = await supabase
      .from("locations")
      .update({
        name: input.name,
        address: input.address ?? null,
        surface: input.surface,
        hard_courts: input.hardCourts,
        clay_courts: input.clayCourts,
      })
      .eq("id", id)
      .select(LOCATION_COLUMNS)
      .single();

    if (error) {
      console.error("updateLocation failed:", error);
      throw new Error("Couldn't save location. Try again.");
    }

    revalidatePath("/locations");
    return { ok: true, data: mapLocationRow(data) };
  } catch (e) {
    unstable_rethrow(e);
    return { ok: false, error: e instanceof Error ? e.message : "Couldn't save location. Try again." };
  }
}

export async function deleteLocation(id: string): Promise<ActionResult> {
  try {
    await requireCoachId();
    const supabase = await createClient();

    const { error } = await supabase.from("locations").delete().eq("id", id);

    if (error) {
      console.error("deleteLocation failed:", error);
      // 23503 = foreign_key_violation — a class or series still references
      // this location (any coach's, since locations are shared club-wide).
      // Matches deleteStudent's behavior in students.ts.
      throw new Error(
        error.code === "23503"
          ? "Couldn't delete location — it still has classes scheduled there. Remove those first."
          : "Couldn't delete location. Try again.",
      );
    }

    revalidatePath("/locations");
    return { ok: true, data: undefined };
  } catch (e) {
    unstable_rethrow(e);
    return { ok: false, error: e instanceof Error ? e.message : "Couldn't delete location. Try again." };
  }
}
