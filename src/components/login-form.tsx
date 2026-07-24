"use client"

import { useActionState, useId } from "react"
import Link from "next/link"

import { login, type LoginState } from "@/app/login/actions"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { GoogleAuthButton } from "@/components/google-auth-button"

const initialState: LoginState = {}

export function LoginForm() {
  const formId = useId()
  const [state, action, pending] = useActionState(login, initialState)

  return (
    <div className="flex flex-col gap-4">
      <GoogleAuthButton />

      <div className="flex items-center gap-3">
        <div className="h-px flex-1 bg-border" />
        <span className="text-xs text-muted-foreground">or</span>
        <div className="h-px flex-1 bg-border" />
      </div>

      <form action={action} className="flex flex-col gap-4">
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
            autoComplete="current-password"
            required
          />
        </div>

        {state.error && <p className="text-sm text-destructive">{state.error}</p>}

        <Button type="submit" variant="positive" className="mt-2 w-full" disabled={pending}>
          {pending ? "Signing in…" : "Sign in"}
        </Button>
      </form>

      <p className="text-center text-sm text-muted-foreground">
        Don&apos;t have an account?{" "}
        <Link href="/signup" className="font-medium text-foreground underline-offset-4 hover:underline">
          Sign up
        </Link>
      </p>
    </div>
  )
}
