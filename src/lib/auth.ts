import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

export interface CurrentCoach {
  id: string;
  name: string;
  email: string;
}

// Fails closed: a missing or non-coach profile row never grants coach
// access. Every authenticated user has a `profiles` row (coaches are
// backfilled/created at signup; students are created by the invite
// redemption trigger) — see BACKEND.md for the full role model.
export async function requireCoach(): Promise<CurrentCoach> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();

  if (profile?.role !== "coach") {
    redirect("/student");
  }

  const fullName = typeof user.user_metadata?.full_name === "string" ? user.user_metadata.full_name.trim() : "";

  return { id: user.id, name: fullName || user.email || "Coach", email: user.email ?? "" };
}

export async function requireCoachId(): Promise<string> {
  const { id } = await requireCoach();
  return id;
}

export interface CurrentStudent {
  id: string; // auth user id
  studentId: string; // linked students.id
  name: string;
  email: string;
}

export async function requireStudent(): Promise<CurrentStudent> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: student } = await supabase.from("students").select("id, name").eq("auth_user_id", user.id).single();

  if (!student) {
    redirect("/login");
  }

  return { id: user.id, studentId: student.id, name: student.name, email: user.email ?? "" };
}
