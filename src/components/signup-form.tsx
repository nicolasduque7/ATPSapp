"use client"

import { useActionState, useId } from "react"
import Link from "next/link"
import { MailCheck } from "lucide-react"

import { signup, type SignupState } from "@/app/signup/actions"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { GoogleAuthButton } from "@/components/google-auth-button"

const initialState: SignupState = {}

export function SignupForm() {
  const formId = useId()
  const [state, action, pending] = useActionState(signup, initialState)

  if (state.checkEmail) {
    return (
      <div className="flex flex-col items-center gap-3 py-2 text-center">
        <div className="flex size-12 items-center justify-center rounded-full bg-positive/10 text-positive">
          <MailCheck className="size-6" />
        </div>
        <p className="font-heading text-base font-bold text-foreground">Check your email</p>
        <p className="text-sm text-muted-foreground">
          We sent you a confirmation link. Click it to activate your account, then sign in.
        </p>
        <Link
          href="/login"
          className="mt-2 text-sm font-medium text-foreground underline-offset-4 hover:underline"
        >
          Back to sign in
        </Link>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <GoogleAuthButton label="Sign up with Google" />

      <div className="flex items-center gap-3">
        <div className="h-px flex-1 bg-border" />
        <span className="text-xs text-muted-foreground">or</span>
        <div className="h-px flex-1 bg-border" />
      </div>

      <form action={action} className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <label htmlFor={`${formId}-name`} className="text-xs font-medium text-muted-foreground">
            Full name
          </label>
          <Input
            id={`${formId}-name`}
            name="fullName"
            type="text"
            autoComplete="name"
            required
            placeholder="Alex Rivera"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor={`${formId}-email`} className="text-xs font-medium text-muted-foreground">
            Email
          </label>
          <Input
            id={`${formId}-email`}
            name="email"
            type="email"
            autoComplete="email"
            required
            placeholder="you@example.com"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor={`${formId}-password`} className="text-xs font-medium text-muted-foreground">
            Password
          </label>
          <Input
            id={`${formId}-password`}
            name="password"
            type="password"
            autoComplete="new-password"
            required
            minLength={6}
          />
        </div>

        {state.error && <p className="text-sm text-destructive">{state.error}</p>}

        <Button type="submit" variant="positive" className="mt-2 w-full" disabled={pending}>
          {pending ? "Creating account…" : "Create account"}
        </Button>
      </form>

      <p className="text-center text-sm text-muted-foreground">
        Already have an account?{" "}
        <Link href="/login" className="font-medium text-foreground underline-offset-4 hover:underline">
          Sign in
        </Link>
      </p>
    </div>
  )
}
