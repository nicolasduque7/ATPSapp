"use client"

import { useEffect, useState } from "react"
import { useTranslations } from "next-intl"

import { useHasMounted } from "@/lib/hooks/use-has-mounted"

interface NextClassCountdownProps {
  startTime: Date
}

export function NextClassCountdown({ startTime }: NextClassCountdownProps) {
  const hasMounted = useHasMounted()
  const t = useTranslations("dashboard")
  const [now, setNow] = useState(() => new Date())

  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 60_000)
    return () => clearInterval(interval)
  }, [])

  if (!hasMounted) return null

  const totalMinutes = Math.max(0, Math.round((startTime.getTime() - now.getTime()) / 60_000))
  const time =
    totalMinutes < 60
      ? t("minutesShort", { minutes: totalMinutes })
      : totalMinutes % 60 === 0
        ? t("hoursShort", { hours: Math.floor(totalMinutes / 60) })
        : t("hoursMinutesShort", { hours: Math.floor(totalMinutes / 60), minutes: totalMinutes % 60 })

  return <>{t("inTime", { time })}</>
}
