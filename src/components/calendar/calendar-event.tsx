"use client"

import { useEffect, useRef, useState } from "react"
import type { EventProps } from "react-big-calendar"

import { LevelBadge } from "@/components/level-badge"
import { LocationTag } from "@/components/location-tag"
import { ClassTypeTag } from "@/components/class-type-tag"
import { RecurringTag } from "@/components/recurring-tag"
import { OpenClassTag } from "@/components/open-class-tag"
import { cn } from "@/lib/utils"
import type { CalendarEvent } from "@/components/calendar/types"

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

interface CoachAwareEventProps {
  event: CalendarEvent
  currentCoachId: string
}

/**
 * react-big-calendar gives events a fixed pixel height derived from their
 * duration and the grid's time scale — a 45min slot can be as short as
 * ~30px. Rather than clip content or force the calendar taller, this tile
 * measures its own box and drops fields as room shrinks, always keeping
 * time + the primary label (student name for a class, coach name for an
 * availability block).
 */
function useTileHeight() {
  const ref = useRef<HTMLDivElement>(null)
  const [height, setHeight] = useState<number | null>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const observer = new ResizeObserver(([entry]) => setHeight(entry.contentRect.height))
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  return { ref, height }
}

function ClassEventTile({ event, currentCoachId }: CoachAwareEventProps) {
  const { ref, height } = useTileHeight()
  if (event.kind !== "class") return null
  const { coachId, coachName, studentName, level, locationName, durationMinutes, type, seriesId, isOpen } =
    event.resource
  const isOwn = coachId === currentCoachId

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
        {showBadge && <LevelBadge level={level} className="px-1 py-0 text-[7px] leading-[1.4]" />}
        {showBadge && !isOwn && (
          <span
            className="inline-flex w-fit items-center rounded-full px-2.5 py-0.5 text-[7px] leading-[1.4] font-medium"
            style={{ color: "var(--event-accent)" }}
          >
            {coachName}
          </span>
        )}
      </div>
      {showLocation && <LocationTag name={locationName} className="px-1 py-0 text-[7px] leading-[1.4]" />}
      {showTags && (
        <div className="flex shrink-0 flex-wrap items-center gap-1">
          <ClassTypeTag type={type} className="px-1 py-0 text-[7px] leading-[1.4]" />
          {seriesId && (
            <RecurringTag className="gap-0.5 px-1 py-0 text-[7px] leading-[1.4]" iconClassName="size-2" />
          )}
          {isOpen && (
            <OpenClassTag className="gap-0.5 px-1 py-0 text-[7px] leading-[1.4]" iconClassName="size-2" />
          )}
        </div>
      )}
    </div>
  )
}

function AvailabilityEventTile({ event }: { event: CalendarEvent }) {
  const { ref, height } = useTileHeight()
  if (event.kind !== "availability") return null
  const { coachName, locationNames } = event.resource

  const showLocations = height === null || height >= 46

  return (
    <div
      ref={ref}
      className="flex h-full flex-col justify-center gap-0.5 overflow-hidden px-2 py-1 text-left leading-tight"
    >
      <p className="shrink-0 truncate text-[11px] font-semibold text-foreground">
        {formatTime(event.start)} – {formatTime(event.end)}
      </p>
      <span className="truncate text-xs font-medium text-foreground">{coachName}</span>
      {showLocations && locationNames.length > 0 && (
        <div className="flex shrink-0 flex-wrap items-center gap-1">
          {locationNames.map((name) => (
            <LocationTag key={name} name={name} className="px-1 py-0 text-[7px] leading-[1.4]" />
          ))}
        </div>
      )}
    </div>
  )
}

export function CalendarEventTile({ event, currentCoachId }: CoachAwareEventProps) {
  if (event.kind === "availability") return <AvailabilityEventTile event={event} />
  return <ClassEventTile event={event} currentCoachId={currentCoachId} />
}

export function CalendarEventTileCompact({ event, currentCoachId }: CoachAwareEventProps) {
  if (event.kind === "availability") {
    const { coachName, locationNames } = event.resource
    const tooltip = `${formatTime(event.start)} – ${formatTime(event.end)}\n${coachName}\n${locationNames.join(", ")}`
    return (
      <div title={tooltip} className="flex items-center gap-1 overflow-hidden text-xs">
        <span className={cn("shrink-0 font-semibold text-foreground")}>{formatTime(event.start)}</span>
        <span className="truncate text-foreground/80">{coachName} · available</span>
      </div>
    )
  }

  const { coachId, coachName, studentName, level, locationName, durationMinutes, isOpen } = event.resource
  const isOwn = coachId === currentCoachId
  const tooltip = `${formatTime(event.start)} – ${formatTime(event.end)} · ${formatDuration(
    durationMinutes
  )}\n${studentName} · ${level}\n${locationName}${isOwn ? "" : `\n${coachName}`}${isOpen ? "\nOpen Class" : ""}`

  return (
    <div title={tooltip} className="flex items-center gap-1 overflow-hidden text-xs">
      <span className="shrink-0 font-semibold text-foreground">{formatTime(event.start)}</span>
      <span className="truncate text-foreground/80">{studentName}</span>
      {!isOwn && <span className="truncate text-[0.7rem] text-muted-foreground">· {coachName}</span>}
    </div>
  )
}

// Re-export the EventProps type shape callers may need.
export type { EventProps }
