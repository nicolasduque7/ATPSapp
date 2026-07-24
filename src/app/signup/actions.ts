"use server";

import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

export interface SignupState {
  error?: string;
  checkEmail?: boolean;
}

export async function signup(_prevState: SignupState, formData: FormData): Promise<SignupState> {
  const fullName = String(formData.get("fullName") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!fullName || !email || !password) {
    return { error: "Fill in your name, email, and password." };
  }
  if (password.length < 6) {
    return { error: "Password must be at least 6 characters." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { full_name: fullName } },
  });

  if (error) {
    return {
      error: error.message.toLowerCase().includes("already registered")
        ? "An account with this email already exists."
        : "Couldn't create your account. Try again.",
    };
  }

  // If the project requires email confirmation, signUp succeeds but returns
  // no session — there's nothing to redirect into yet.
  if (!data.session) {
    return { checkEmail: true };
  }

  redirect("/");
}
