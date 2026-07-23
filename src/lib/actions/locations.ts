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
  const coachId = await requireCoachId();
  const supabase = await createClient();

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
    .eq("coach_id", coachId)
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
  const coachId = await requireCoachId();
  const supabase = await createClient();

  const { error } = await supabase
    .from("locations")
    .delete()
    .eq("id", id)
    .eq("coach_id", coachId);

  if (error) {
    console.error("deleteLocation failed:", error);
    throw new Error("Couldn't delete location — it may still have classes scheduled there.");
  }

  revalidatePath("/locations");
}
