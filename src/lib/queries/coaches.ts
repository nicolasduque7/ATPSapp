import { requireCoachId } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { Coach } from "@/lib/mock-data";

export async function getCoaches(): Promise<Coach[]> {
  await requireCoachId();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("profiles")
    .select("id, display_name")
    .eq("role", "coach")
    .order("display_name");

  if (error) {
    console.error("getCoaches failed:", error);
    throw new Error("Couldn't load coaches. Try again.");
  }

  return (data ?? []).map((row) => ({ id: row.id, name: row.display_name ?? "Coach" }));
}
