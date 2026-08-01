import { enUS, es } from "date-fns/locale"
import type { Locale as DateFnsLocale } from "date-fns"

import type { Locale } from "@/i18n/locale"

const DATE_FNS_LOCALES: Record<Locale, DateFnsLocale> = { en: enUS, es }

export function getDateFnsLocale(locale: string): DateFnsLocale {
  return DATE_FNS_LOCALES[locale as Locale] ?? enUS
}
