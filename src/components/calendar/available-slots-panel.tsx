"use client"

import { useEffect, useMemo, useState } from "react"
import { useLocale, useTranslations } from "next-intl"

import { cn } from "@/lib/utils"
import { addDays, bucketFreeWindows, combineDateAndTime, formatDateOnly, type TimeWindow } from "@/lib/dates"
import { getAvailableSlotSuggestions, type DayAvailability } from "@/lib/actions/availability-suggestions"
import { formatDateOffsetLabel, getTimeLabel, toTimeInputValue } from "@/components/calendar/recurrence-fields"

const LOOKAHEAD_DAYS = 14
const SLOT_INCREMENT_MINUTES = 30

interface AvailableSlotsPanelProps {
  coachId: string | null
  locationId: string | null
  anchorDateOffset: number
  durationMinutes: number
  today: Date
  excludeClassId?: string
  excludeSeriesId?: string
  onPickSlot: (result: { dateOffset: number; startTime: string; endTime: string }) => void
}

export function AvailableSlotsPanel({
  coachId,
  locationId,
  anchorDateOffset,
  durationMinutes,
  today,
  excludeClassId,
  excludeSeriesId,
  onPickSlot,
}: AvailableSlotsPanelProps) {
  const t = useTranslations("availableSlots")
  const tf = useTranslations("classForm")
  const locale = useLocale()
  const labels = { today: tf("today"), tomorrow: tf("tomorrow"), yesterday: tf("yesterday") }

  const [days, setDays] = useState<DayAvailability[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loadedKey, setLoadedKey] = useState<string | null>(null)
  const [selectedDayIndex, setSelectedDayIndex] = useState(0)

  const requestKey =
    coachId && locationId
      ? `${coachId}:${locationId}:${anchorDateOffset}:${excludeClassId ?? ""}:${excludeSeriesId ?? ""}`
      : null
  const loading = requestKey !== null && requestKey !== loadedKey

  useEffect(() => {
    if (!coachId || !locationId || !requestKey) {
      return
    }
    let cancelled = false
    const fromDate = formatDateOnly(addDays(today, anchorDateOffset))
    getAvailableSlotSuggestions(
      coachId,
      locationId,
      fromDate,
      LOOKAHEAD_DAYS,
      excludeClassId,
      excludeSeriesId,
    ).then((result) => {
      if (cancelled) return
      setLoadedKey(requestKey)
      if (!result.ok) {
        setError(result.error)
        setDays(null)
        return
      }
      setError(null)
      setDays(result.data)
      const firstWithSlots = result.data.findIndex((day) => day.freeWindows.length > 0)
      setSelectedDayIndex(firstWithSlots === -1 ? 0 : firstWithSlots)
    })
    return () => {
      cancelled = true
    }
  }, [coachId, locationId, anchorDateOffset, requestKey, today, excludeClassId, excludeSeriesId])

  const selectedDay = days?.[selectedDayIndex] ?? null

  const slots = useMemo(() => {
    if (!selectedDay) return []
    const windows: TimeWindow[] = selectedDay.freeWindows.map((w) => ({
      start: combineDateAndTime(today, w.startTime),
      end: combineDateAndTime(today, w.endTime),
    }))
    return bucketFreeWindows(windows, durationMinutes, SLOT_INCREMENT_MINUTES)
  }, [selectedDay, durationMinutes, today])

  if (!coachId || !locationId) return null

  const hasAnyAvailability = days?.some((day) => day.freeWindows.length > 0) ?? true
  const anchorHasNoSlots = days ? (days[0]?.freeWindows.length ?? 0) === 0 : false

  return (
    <div className="flex flex-col gap-2 rounded-2xl border border-border bg-muted/40 p-3">
      <span className="text-xs font-medium text-muted-foreground">{t("title")}</span>

      {loading && (
        <>
          <p className="text-sm text-muted-foreground">{t("loading")}</p>
          <div className="flex gap-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-8 w-16 animate-pulse rounded-full bg-muted motion-reduce:animate-none" />
            ))}
          </div>
        </>
      )}

      {!loading && error && <p className="text-sm text-destructive">{error}</p>}

      {!loading && !error && days && (
        <>
          {!hasAnyAvailability && <p className="text-sm text-muted-foreground">{t("noAvailabilityWindow")}</p>}
          {hasAnyAvailability && anchorHasNoSlots && (
            <p className="text-sm text-muted-foreground">{t("jumpedForward")}</p>
          )}

          <div className="flex flex-wrap gap-2">
            {days.map((day, index) => {
              const hasSlots = day.freeWindows.length > 0
              const selected = index === selectedDayIndex
              return (
                <button
                  key={day.date}
                  type="button"
                  disabled={!hasSlots}
                  onClick={() => setSelectedDayIndex(index)}
                  className={cn(
                    "cursor-pointer rounded-full border-2 px-3 py-1.5 text-xs font-medium transition-colors duration-200 motion-reduce:transition-none disabled:cursor-not-allowed disabled:opacity-40",
                    selected
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-transparent bg-muted text-muted-foreground hover:bg-accent"
                  )}
                >
                  {formatDateOffsetLabel(anchorDateOffset + index, today, labels, locale)}
                </button>
              )
            })}
          </div>

          {selectedDay && hasSlots(selectedDay) && (
            <div className="flex flex-wrap gap-2 pt-1">
              {slots.map((slot) => (
                <button
                  key={toTimeInputValue(slot.start)}
                  type="button"
                  onClick={() =>
                    onPickSlot({
                      dateOffset: anchorDateOffset + selectedDayIndex,
                      startTime: toTimeInputValue(slot.start),
                      endTime: toTimeInputValue(slot.end),
                    })
                  }
                  className="cursor-pointer rounded-full bg-background px-3 py-1.5 text-xs font-medium text-foreground shadow-sm transition-colors duration-200 hover:bg-accent motion-reduce:transition-none"
                >
                  {getTimeLabel(toTimeInputValue(slot.start))}
                </button>
              ))}
            </div>
          )}

          {selectedDay && !hasSlots(selectedDay) && hasAnyAvailability && (
            <p className="text-sm text-muted-foreground">{t("noneToday")}</p>
          )}
        </>
      )}
    </div>
  )
}

function hasSlots(day: DayAvailability): boolean {
  return day.freeWindows.length > 0
}
