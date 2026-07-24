"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";

import { requireCoachId } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

// Returns the invite link for the coach to copy/send manually. Automated
// email delivery is a separate, later integration choice — see BACKEND.md.
export async function inviteStudent(studentId: string, email: string): Promise<string> {
  const coachId = await requireCoachId();
  const supabase = await createClient();

  const trimmedEmail = email.trim();
  if (!trimmedEmail) {
    throw new Error("Enter the student's email address.");
  }

  const { error: emailError } = await supabase.from("students").update({ email: trimmedEmail }).eq("id", studentId);
  if (emailError) {
    console.error("inviteStudent (setting email) failed:", emailError);
    throw new Error(
      emailError.code === "23505"
        ? "That email is already linked to another student."
        : "Couldn't save the student's email. Try again.",
    );
  }

  const { data, error } = await supabase
    .from("student_invites")
    .insert({ student_id: studentId, email: trimmedEmail, invited_by: coachId })
    .select("token")
    .single();

  if (error) {
    console.error("inviteStudent failed:", error);
    throw new Error("Couldn't create the invite. Try again.");
  }

  const h = await headers();
  const origin = h.get("origin") ?? `${h.get("x-forwarded-proto") ?? "http"}://${h.get("host")}`;

  revalidatePath("/students");
  return `${origin}/invite/${data.token}`;
}
