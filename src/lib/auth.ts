import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

export interface CurrentCoach {
  id: string;
  name: string;
  email: string;
}

export async function requireCoach(): Promise<CurrentCoach> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const fullName = typeof user.user_metadata?.full_name === "string" ? user.user_metadata.full_name.trim() : "";

  return { id: user.id, name: fullName || user.email || "Coach", email: user.email ?? "" };
}

export async function requireCoachId(): Promise<string> {
  const { id } = await requireCoach();
  return id;
}
