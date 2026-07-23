import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

export async function requireCoachId(): Promise<string> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  return user.id;
}
