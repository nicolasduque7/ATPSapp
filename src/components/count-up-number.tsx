"use client"

import { useEffect, useState } from "react"

import { usePrefersReducedMotion } from "@/lib/use-prefers-reduced-motion"

interface CountUpNumberProps {
  value: number
  decimals?: number
  suffix?: string
  durationMs?: number
}

function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3)
}

export function CountUpNumber({
  value,
  decimals = 0,
  suffix = "",
  durationMs = 600,
}: CountUpNumberProps) {
  const prefersReducedMotion = usePrefersReducedMotion()
  const [display, setDisplay] = useState(0)

  useEffect(() => {
    if (prefersReducedMotion) return

    let raf: number
    const start = performance.now()

    function tick(now: number) {
      const progress = Math.min(1, (now - start) / durationMs)
      setDisplay(value * easeOutCubic(progress))
      if (progress < 1) {
        raf = requestAnimationFrame(tick)
      }
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [value, durationMs, prefersReducedMotion])

  const shown = prefersReducedMotion ? value : display

  return (
    <>
      {shown.toFixed(decimals)}
      {suffix}
    </>
  )
}
