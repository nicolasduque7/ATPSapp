"use client"

import { useEffect, useState } from "react"

import { useHasMounted } from "@/lib/hooks/use-has-mounted"

interface NextClassCountdownProps {
  startTime: Date
}

function formatCountdown(startTime: Date, now: Date): string {
  const totalMinutes = Math.max(0, Math.round((startTime.getTime() - now.getTime()) / 60_000))
  if (totalMinutes < 60) return `${totalMinutes}m`
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  return minutes === 0 ? `${hours}h` : `${hours}h ${minutes}m`
}

export function NextClassCountdown({ startTime }: NextClassCountdownProps) {
  const hasMounted = useHasMounted()
  const [now, setNow] = useState(() => new Date())

  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 60_000)
    return () => clearInterval(interval)
  }, [])

  if (!hasMounted) return null
  return <>in {formatCountdown(startTime, now)}</>
}
