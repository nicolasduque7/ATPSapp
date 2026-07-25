import { requireCoachId, requireStudent } from "@/lib/auth";
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

// Same query as getCoaches, for the student-facing coach-picker and
// availability toggle labels — relies on the profiles_select_student_directory
// RLS policy.
export async function getCoachesForStudent(): Promise<Coach[]> {
  await requireStudent();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("profiles")
    .select("id, display_name")
    .eq("role", "coach")
    .order("display_name");

  if (error) {
    console.error("getCoachesForStudent failed:", error);
    throw new Error("Couldn't load coaches. Try again.");
  }

  return (data ?? []).map((row) => ({ id: row.id, name: row.display_name ?? "Coach" }));
}
