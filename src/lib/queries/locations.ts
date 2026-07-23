import { requireCoachId } from "@/lib/auth";
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
