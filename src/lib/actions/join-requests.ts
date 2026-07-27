"use server";

import { revalidatePath } from "next/cache";

import { requireStudent } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

// Wraps request_to_join_class (see the class_join_requests migration), which
// resolves the caller's student_id server-side and validates the class is
// open, not the caller's own, not already joined/pending, and has room —
// this action just surfaces the RPC's error message and revalidates the
// pages that show classes.
export async function requestToJoinClass(classId: string): Promise<void> {
  await requireStudent();
  const supabase = await createClient();

  const { error } = await supabase.rpc("request_to_join_class", { p_class_id: classId });

  if (error) {
    console.error("requestToJoinClass failed:", error);
    throw new Error(error.message || "Couldn't send the join request. Try again.");
  }

  revalidatePath("/student/calendar");
  revalidatePath("/student");
}
