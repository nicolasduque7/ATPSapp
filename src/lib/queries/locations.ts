import { requireCoachId, requireStudent } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { Location } from "@/lib/mock-data";
import { mapLocationRow, LOCATION_COLUMNS } from "@/lib/queries/location-row";

export async function getLocations(): Promise<Location[]> {
  await requireCoachId();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("locations")
    .select(LOCATION_COLUMNS)
    .order("name");

  if (error) {
    console.error("getLocations failed:", error);
    throw new Error("Couldn't load locations. Try again.");
  }

  return (data ?? []).map(mapLocationRow);
}

// Same query as getLocations, gated for a student caller — locations RLS is
// already club-wide/shared, this just matches the auth-check convention.
export async function getLocationsForStudent(): Promise<Location[]> {
  await requireStudent();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("locations")
    .select(LOCATION_COLUMNS)
    .order("name");

  if (error) {
    console.error("getLocationsForStudent failed:", error);
    throw new Error("Couldn't load locations. Try again.");
  }

  return (data ?? []).map(mapLocationRow);
}
