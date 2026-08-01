"use client"

import { LogOut } from "lucide-react"
import { useTranslations } from "next-intl"

import { Button } from "@/components/ui/button"
import { signOut } from "@/lib/actions/auth"

export function SignOutButton() {
  const t = useTranslations("accountMenu")
  return (
    <form action={signOut}>
      <Button
        type="submit"
        variant="outline"
        size="icon"
        aria-label={t("signOut")}
        className="rounded-full border-black/5 bg-sidebar/85 shadow-[0_8px_24px_rgba(0,0,0,0.08)] backdrop-blur-md dark:border-white/10 md:border-border md:bg-card md:shadow-[0_1px_3px_rgba(0,0,0,0.04)] md:backdrop-blur-none"
      >
        <LogOut />
      </Button>
    </form>
  )
}
