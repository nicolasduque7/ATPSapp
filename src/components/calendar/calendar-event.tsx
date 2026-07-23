"use client"

import { useEffect, useRef, useState } from "react"
import type { EventProps } from "react-big-calendar"

import { LevelBadge } from "@/components/level-badge"
import { LocationTag } from "@/components/location-tag"
import { ClassTypeTag } from "@/components/class-type-tag"
import { RecurringTag } from "@/components/recurring-tag"
import type { CalendarClassEvent } from "@/components/calendar/types"

function formatTime(date: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
  }).format(date)
}

function formatDuration(minutes: number): string {
  if (minutes % 60 === 0) return `${minutes / 60}h`
  return `${minutes}m`
}

/**
 * react-big-calendar gives events a fixed pixel height derived from their
 * duration and the grid's time scale — a 45min slot can be as short as
 * ~30px. Rather than clip content or force the calendar taller, this tile
 * measures its own box and drops fields (location, then the level badge)
 * as room shrinks, always keeping time + student name.
 */
export function ClassEventTile({ event }: EventProps<CalendarClassEvent>) {
  const ref = useRef<HTMLDivElement>(null)
  const [height, setHeight] = useState<number | null>(null)
  const { studentName, level, locationName, durationMinutes, type, seriesId } = event.resource

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const observer = new ResizeObserver(([entry]) => setHeight(entry.contentRect.height))
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  const showLocation = height === null || height >= 46
  const showBadge = height === null || height >= 22
  const showTags = height === null || height >= 60

  return (
    <div
      ref={ref}
      className="flex h-full flex-col justify-center gap-0.5 overflow-hidden px-2 py-1 text-left leading-tight"
    >
      <p className="shrink-0 truncate text-[11px] font-semibold text-foreground">
        {formatTime(event.start)} – {formatTime(event.end)} · {formatDuration(durationMinutes)}
      </p>
      <div className="flex shrink-0 flex-wrap items-center gap-1">
        <span className="truncate text-xs font-medium text-foreground">{studentName}</span>
        {showBadge && (
          <LevelBadge level={level} className="px-1 py-0 text-[7px] leading-[1.4]" />
        )}
      </div>
      {showLocation && (
        <LocationTag name={locationName} className="px-1 py-0 text-[7px] leading-[1.4]" />
      )}
      {showTags && (
        <div className="flex shrink-0 flex-wrap items-center gap-1">
          <ClassTypeTag type={type} className="px-1 py-0 text-[7px] leading-[1.4]" />
          {seriesId && (
            <RecurringTag
              className="gap-0.5 px-1 py-0 text-[7px] leading-[1.4]"
              iconClassName="size-2"
            />
          )}
        </div>
      )}
    </div>
  )
}

export function ClassEventTileCompact({ event }: EventProps<CalendarClassEvent>) {
  const { studentName, level, locationName, durationMinutes } = event.resource
  const tooltip = `${formatTime(event.start)} – ${formatTime(event.end)} · ${formatDuration(
    durationMinutes
  )}\n${studentName} · ${level}\n${locationName}`

  return (
    <div title={tooltip} className="flex items-center gap-1 overflow-hidden text-xs">
      <span className="shrink-0 font-semibold text-foreground">{formatTime(event.start)}</span>
      <span className="truncate text-foreground/80">{studentName}</span>
    </div>
  )
}
