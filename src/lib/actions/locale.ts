"use server";

import { cookies } from "next/headers";

import { LOCALE_COOKIE, type Locale } from "@/i18n/locale";

export async function setLocale(locale: Locale): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(LOCALE_COOKIE, locale, { path: "/", maxAge: 60 * 60 * 24 * 365 });
}
