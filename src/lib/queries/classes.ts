import { requireCoachId } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { toLocalTimestamp } from "@/lib/dates";
import type { ClassInstance } from "@/lib/mock-data";
import { mapClassRow, CLASS_COLUMNS } from "@/lib/queries/class-row";

export async function getUpcomingClasses(): Promise<ClassInstance[]> {
  await requireCoachId();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("classes")
    .select(CLASS_COLUMNS)
    .gte("start_time", toLocalTimestamp(new Date()))
    .order("start_time");

  if (error) {
    console.error("getUpcomingClasses failed:", error);
    throw new Error("Couldn't load classes. Try again.");
  }

  // Every row matched start_time >= now, so none of these can be completed.
  return (data ?? []).map((row) => mapClassRow(row, false));
}

export async function getAllClasses(): Promise<ClassInstance[]> {
  await requireCoachId();
  const supabase = await createClient();

  const { data, error } = await supabase.from("classes").select(CLASS_COLUMNS).order("start_time");

  if (error) {
    console.error("getAllClasses failed:", error);
    throw new Error("Couldn't load classes. Try again.");
  }

  const now = new Date();
  return (data ?? []).map((row) => mapClassRow(row, new Date(row.end_time) < now));
}
