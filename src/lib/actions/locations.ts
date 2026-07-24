"use server";

import { revalidatePath } from "next/cache";

import { requireCoachId } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { CourtSurface, Location } from "@/lib/mock-data";
import { mapLocationRow, LOCATION_COLUMNS } from "@/lib/queries/location-row";

export interface LocationInput {
  name: string;
  address?: string;
  surface: CourtSurface;
  hardCourts: number;
  clayCourts: number;
}

export async function createLocation(input: LocationInput): Promise<Location> {
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
  return mapLocationRow(data);
}

export async function updateLocation(id: string, input: LocationInput): Promise<Location> {
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
  return mapLocationRow(data);
}

export async function deleteLocation(id: string): Promise<void> {
  await requireCoachId();
  const supabase = await createClient();

  const { error } = await supabase.from("locations").delete().eq("id", id);

  if (error) {
    console.error("deleteLocation failed:", error);
    throw new Error("Couldn't delete location — it may still have classes scheduled there.");
  }

  revalidatePath("/locations");
}
