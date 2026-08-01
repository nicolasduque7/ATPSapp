"use client"

import { useActionState, useId } from "react"
import Link from "next/link"
import { useTranslations } from "next-intl"

import { login, type LoginState } from "@/app/login/actions"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

const initialState: LoginState = {}

export function LoginForm() {
  const formId = useId()
  const t = useTranslations("auth.login")
  const [state, action, pending] = useActionState(login, initialState)

  return (
    <div className="flex flex-col gap-4">
      <form action={action} className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <label htmlFor={`${formId}-email`} className="text-xs font-medium text-muted-foreground">
            {t("emailLabel")}
          </label>
          <Input
            id={`${formId}-email`}
            name="email"
            type="email"
            autoComplete="email"
            required
            placeholder={t("emailPlaceholder")}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor={`${formId}-password`} className="text-xs font-medium text-muted-foreground">
            {t("passwordLabel")}
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
          {pending ? t("submitPending") : t("submit")}
        </Button>
      </form>

      <p className="text-center text-sm text-muted-foreground">
        {t("noAccount")}{" "}
        <Link href="/signup" className="font-medium text-foreground underline-offset-4 hover:underline">
          {t("signUpLink")}
        </Link>
      </p>
    </div>
  )
}
