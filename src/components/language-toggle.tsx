"use client"

import { useLocale, useTranslations } from "next-intl"
import { useRouter } from "next/navigation"
import { useTransition } from "react"

import { Button } from "@/components/ui/button"
import { setLocale } from "@/lib/actions/locale"
import type { Locale } from "@/i18n/locale"

export function LanguageToggle() {
  const locale = useLocale()
  const t = useTranslations("auth.login")
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const nextLocale: Locale = locale === "en" ? "es" : "en"

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      aria-label={locale === "en" ? t("switchToSpanish") : t("switchToEnglish")}
      disabled={isPending}
      className="text-sidebar-foreground text-xs font-semibold hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
      onClick={() =>
        startTransition(async () => {
          await setLocale(nextLocale)
          router.refresh()
        })
      }
    >
      {locale.toUpperCase()}
    </Button>
  )
}
