"use server";

import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

export interface RedeemState {
  error?: string;
}

interface InvitePreview {
  valid: boolean;
  reason: string;
  student_name: string;
  coach_name: string;
  email: string;
}

export async function redeemInvite(_prevState: RedeemState, formData: FormData): Promise<RedeemState> {
  const token = String(formData.get("token") ?? "");
  const password = String(formData.get("password") ?? "");

  if (!token) {
    return { error: "This invite link is invalid." };
  }
  if (password.length < 6) {
    return { error: "Password must be at least 6 characters." };
  }

  const supabase = await createClient();

  const { data: preview, error: previewError } = await supabase
    .rpc("get_invite_preview", { p_token: token })
    .single<InvitePreview>();

  if (previewError || !preview?.valid) {
    return { error: "This invite link is no longer valid. Ask your coach to resend it." };
  }

  // The redemption trigger (handle_new_user, see BACKEND.md) runs inside the
  // same transaction as this insert and re-validates everything (expiry,
  // already-redeemed, email match) — the preview check above is a friendlier
  // first pass, not the source of truth. Note: GoTrue may not always surface
  // the trigger's exact raised message through `error.message` verbatim, so
  // this falls back to a generic message when it doesn't.
  const { error } = await supabase.auth.signUp({
    email: preview.email,
    password,
    options: { data: { invite_token: token } },
  });

  if (error) {
    return { error: error.message || "Couldn't complete signup. Please check your details or ask your coach for a new invite link." };
  }

  redirect("/student");
}
