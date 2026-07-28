"use client"

import { useEffect, useId, useMemo, useState } from "react"
import { differenceInCalendarDays, startOfDay } from "date-fns"
import { Trash2 } from "lucide-react"

import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { cn } from "@/lib/utils"
import { getLocationColorStyle } from "@/lib/location-colors"
import {
  addDays,
  combineClubDateAndTime,
  formatDateOnly,
  parseDateOnly,
  toClubZoned,
  zonedNow,
  type SeriesFrequency,
} from "@/lib/dates"
import { getAvailabilitySeriesMeta } from "@/lib/actions/availability"
import {
  DAY_OF_MONTH_OPTIONS,
  DateOffsetField,
  EVERY_OPTIONS,
  FREQUENCIES,
  ReadOnlyField,
  SegmentedToggle,
  TimeField,
  WEEKDAY_LABELS,
  buildOffsetRange,
  frequencyUnit,
  ordinal,
  pluralUnit,
  toTimeInputValue,
} from "@/components/calendar/recurrence-fields"
import type { Location } from "@/lib/mock-data"
import type { AvailabilityDialogTarget, AvailabilityFormSubmission } from "@/components/calendar/types"

interface AvailabilityEditDialogProps {
  target: AvailabilityDialogTarget | null
  locations: Location[]
  onOpenChange: (open: boolean) => void
  onSave: (submission: AvailabilityFormSubmission) => Promise<void>
  onDelete?: (target: { kind: "block" | "series"; id: string }) => Promise<void>
}

const DATE_RANGE_BEFORE = 14
const DATE_RANGE_AFTER = 90
const SERIES_RANGE_AFTER = 180
const DEFAULT_SERIES_LENGTH_DAYS = 56

function targetKey(target: AvailabilityDialogTarget): string {
  if (target.kind === "block") return `block-${target.block.id}`
  if (target.kind === "series") return `series-${target.series.id}`
  return "create"
}

export function AvailabilityEditDialog({
  target,
  locations,
  onOpenChange,
  onSave,
  onDelete,
}: AvailabilityEditDialogProps) {
  return (
    <Dialog open={!!target} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{target?.kind === "create" ? "Add working hours" : "Edit working hours"}</DialogTitle>
        </DialogHeader>

        {target && (
          <AvailabilityEditForm
            key={targetKey(target)}
            target={target}
            locations={locations}
            onOpenChange={onOpenChange}
            onSave={onSave}
            onDelete={onDelete}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}

interface AvailabilityEditFormProps {
  target: AvailabilityDialogTarget
  locations: Location[]
  onOpenChange: (open: boolean) => void
  onSave: (submission: AvailabilityFormSubmission) => Promise<void>
  onDelete?: (target: { kind: "block" | "series"; id: string }) => Promise<void>
}

function AvailabilityEditForm({ target, locations, onOpenChange, onSave, onDelete }: AvailabilityEditFormProps) {
  const formId = useId()
  const isBlockEdit = target.kind === "block"
  const isSeriesEdit = target.kind === "series"
  // A materialized block clicked on the Calendar may belong to a recurring
  // series — in that case (unlike a genuine one-off block) the coach gets
  // the same "this occurrence / whole series" choice classes already offer.
  const blockSeriesId = target.kind === "block" ? (target.block.seriesId ?? null) : null
  const isBlockPartOfSeries = isBlockEdit && !!blockSeriesId

  const [locationIds, setLocationIds] = useState<string[]>(() => {
    if (target.kind === "block") return target.block.locationIds
    if (target.kind === "series") return target.series.locationIds
    return []
  })
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  const [bookingKind, setBookingKind] = useState<"one-off" | "recurring">("one-off")
  const [editScope, setEditScope] = useState<"instance" | "series">("instance")
  const usingRecurringFields =
    isSeriesEdit ||
    (target.kind === "create" && bookingKind === "recurring") ||
    (isBlockPartOfSeries && editScope === "series")

  const today = useMemo(() => startOfDay(zonedNow()), [])

  const initialDateOffset =
    target.kind === "block" ? differenceInCalendarDays(startOfDay(toClubZoned(target.block.startTime)), today) : 0

  // One-off fields: create-as-one-off, editing a one-off block, or editing
  // just "this occurrence" of a series-linked block.
  const [dateOffset, setDateOffset] = useState(initialDateOffset)
  const [singleStartTime, setSingleStartTime] = useState(() =>
    target.kind === "block" ? toTimeInputValue(toClubZoned(target.block.startTime)) : "13:00"
  )
  const [singleEndTime, setSingleEndTime] = useState(() =>
    target.kind === "block" ? toTimeInputValue(toClubZoned(target.block.endTime)) : "17:00"
  )

  // Recurring-pattern fields: creating a series, editing an existing one
  // directly (Settings), or editing "whole series" from a clicked block
  // (Calendar) — the latter is populated by the lazy fetch below.
  const [recurringStartOffset, setRecurringStartOffset] = useState(
    target.kind === "series" ? differenceInCalendarDays(parseDateOnly(target.series.startDate), today) : 0
  )
  const [frequency, setFrequency] = useState<SeriesFrequency>(
    target.kind === "series" ? target.series.frequency : "Weekly"
  )
  const [intervalCount, setIntervalCount] = useState(target.kind === "series" ? target.series.intervalCount : 1)
  const [recurringWeekdays, setRecurringWeekdays] = useState<number[]>(
    target.kind === "series" ? (target.series.weekdays ?? []) : []
  )
  const [dayOfMonth, setDayOfMonth] = useState(target.kind === "series" ? (target.series.dayOfMonth ?? 1) : 1)
  const [recurringStartTime, setRecurringStartTime] = useState(
    target.kind === "series" ? target.series.startTime : "13:00"
  )
  const [recurringEndTime, setRecurringEndTime] = useState(
    target.kind === "series" ? target.series.endTime : "17:00"
  )
  const [recurringUntilOffset, setRecurringUntilOffset] = useState(
    target.kind === "series"
      ? differenceInCalendarDays(parseDateOnly(target.series.endDate), today)
      : DEFAULT_SERIES_LENGTH_DAYS
  )

  const [seriesMetaLoaded, setSeriesMetaLoaded] = useState(false)
  const [seriesMetaError, setSeriesMetaError] = useState<string | null>(null)
  const seriesMetaLoading = isBlockPartOfSeries && editScope === "series" && !seriesMetaLoaded && !seriesMetaError

  useEffect(() => {
    if (!(isBlockPartOfSeries && editScope === "series" && blockSeriesId) || seriesMetaLoaded) return
    let cancelled = false
    getAvailabilitySeriesMeta(blockSeriesId)
      .then((meta) => {
        if (cancelled) return
        setFrequency(meta.frequency)
        setIntervalCount(meta.intervalCount)
        setRecurringWeekdays(meta.weekdays ?? [])
        setDayOfMonth(meta.dayOfMonth ?? 1)
        setRecurringStartTime(meta.startTime)
        setRecurringEndTime(meta.endTime)
        setLocationIds(meta.locationIds)
        setRecurringUntilOffset(differenceInCalendarDays(parseDateOnly(meta.endDate), today))
        setSeriesMetaLoaded(true)
      })
      .catch((err) => {
        if (!cancelled) {
          setSeriesMetaError(err instanceof Error ? err.message : "Couldn't load the series.")
        }
      })
    return () => {
      cancelled = true
    }
  }, [isBlockPartOfSeries, editScope, blockSeriesId, seriesMetaLoaded, today])

  const dateOptions = useMemo(
    () => buildOffsetRange(-DATE_RANGE_BEFORE, DATE_RANGE_AFTER, initialDateOffset),
    [initialDateOffset]
  )
  const seriesRangeOptions = useMemo(
    () => buildOffsetRange(-DATE_RANGE_BEFORE, SERIES_RANGE_AFTER, recurringStartOffset, recurringUntilOffset),
    [recurringStartOffset, recurringUntilOffset]
  )

  function toggleLocation(locationId: string) {
    setLocationIds((prev) =>
      prev.includes(locationId) ? prev.filter((id) => id !== locationId) : [...prev, locationId]
    )
  }

  function toggleRecurringWeekday(day: number) {
    setRecurringWeekdays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day].sort((a, b) => a - b)
    )
  }

  async function handleSubmit(formEvent: React.FormEvent) {
    formEvent.preventDefault()

    if (locationIds.length === 0) {
      setError("Select at least one location.")
      return
    }

    if (usingRecurringFields) {
      if (recurringEndTime <= recurringStartTime) {
        setError("End time must be after the start time.")
        return
      }
      const untilBound = target.kind === "create" ? recurringStartOffset : 0
      if (recurringUntilOffset < untilBound) {
        setError("Until date must be on or after the start date.")
        return
      }
      if (frequency === "Weekly" && recurringWeekdays.length === 0) {
        setError("Select at least one day of the week.")
        return
      }
    } else if (singleEndTime <= singleStartTime) {
      setError("End time must be after the start time.")
      return
    }

    setError(null)
    setSaving(true)
    try {
      if (usingRecurringFields) {
        const weekdays = frequency === "Weekly" ? recurringWeekdays : null
        const dayOfMonthValue = frequency === "Monthly" ? dayOfMonth : null
        if (target.kind === "create") {
          await onSave({
            kind: "series-create",
            input: {
              locationIds,
              frequency,
              intervalCount,
              weekdays,
              dayOfMonth: dayOfMonthValue,
              startDate: formatDateOnly(addDays(today, recurringStartOffset)),
              startTime: recurringStartTime,
              endTime: recurringEndTime,
              endDate: formatDateOnly(addDays(today, recurringUntilOffset)),
            },
          })
        } else {
          const seriesId = target.kind === "series" ? target.series.id : blockSeriesId
          if (!seriesId) return
          await onSave({
            kind: "series-edit",
            seriesId,
            input: {
              locationIds,
              intervalCount,
              weekdays,
              dayOfMonth: dayOfMonthValue,
              startTime: recurringStartTime,
              endTime: recurringEndTime,
              endDate: formatDateOnly(addDays(today, recurringUntilOffset)),
            },
          })
        }
      } else {
        const day = addDays(today, dateOffset)
        const input = {
          locationIds,
          startTime: combineClubDateAndTime(day, singleStartTime),
          endTime: combineClubDateAndTime(day, singleEndTime),
        }
        await onSave(target.kind === "block" ? { kind: "one-off-edit", input } : { kind: "one-off-create", input })
      }
      onOpenChange(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Try again.")
    } finally {
      setSaving(false)
    }
  }

  async function handleConfirmDelete(deleteWholeSeries: boolean) {
    if (!onDelete) return
    setDeleteError(null)
    setDeleting(true)
    try {
      if (target.kind === "series") {
        await onDelete({ kind: "series", id: target.series.id })
      } else if (target.kind === "block") {
        if (deleteWholeSeries && target.block.seriesId) {
          await onDelete({ kind: "series", id: target.block.seriesId })
        } else {
          await onDelete({ kind: "block", id: target.block.id })
        }
      }
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : "Couldn't delete. Try again.")
      setDeleting(false)
    }
  }

  return (
    <>
      <form id={formId} onSubmit={handleSubmit} className="mt-4 flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-muted-foreground">Locations</span>
          <div role="group" aria-label="Locations" className="flex flex-wrap gap-2">
            {locations.map((location) => {
              const style = getLocationColorStyle(location.id, locations)
              const selected = locationIds.includes(location.id)
              return (
                <button
                  key={location.id}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => toggleLocation(location.id)}
                  className={cn(
                    "inline-flex cursor-pointer items-center gap-2 rounded-full border-2 px-3 py-1.5 text-sm font-medium transition-all duration-200 motion-reduce:transition-none",
                    selected
                      ? cn(style.border, style.tint, style.text, style.glow)
                      : "border-transparent bg-muted text-muted-foreground hover:bg-accent"
                  )}
                >
                  <span className={cn("size-2 shrink-0 rounded-full", style.dot)} />
                  {location.name}
                </button>
              )
            })}
          </div>
        </div>

        {target.kind === "create" && (
          <div className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-muted-foreground">Type</span>
            <SegmentedToggle
              ariaLabel="Type"
              value={bookingKind}
              onChange={setBookingKind}
              options={[
                { value: "one-off", label: "One-off" },
                { value: "recurring", label: "Recurring cadence" },
              ]}
            />
          </div>
        )}

        {isBlockPartOfSeries && (
          <div className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-muted-foreground">Applies to</span>
            <SegmentedToggle
              ariaLabel="Applies to"
              value={editScope}
              onChange={setEditScope}
              options={[
                { value: "instance", label: "This block" },
                { value: "series", label: "Whole series" },
              ]}
            />
          </div>
        )}

        {!usingRecurringFields && (
          <>
            <DateOffsetField
              id={`${formId}-date`}
              label="Date"
              value={dateOffset}
              onChange={setDateOffset}
              options={dateOptions}
              today={today}
            />
            <div className="grid grid-cols-2 gap-4">
              <TimeField
                id={`${formId}-start`}
                label="Start time"
                value={singleStartTime}
                onChange={setSingleStartTime}
              />
              <TimeField
                id={`${formId}-end`}
                label="End time"
                value={singleEndTime}
                onChange={setSingleEndTime}
              />
            </div>
          </>
        )}

        {usingRecurringFields && isBlockEdit && seriesMetaLoading && (
          <p className="text-sm text-muted-foreground">Loading series details…</p>
        )}
        {seriesMetaError && <p className="text-sm text-destructive">{seriesMetaError}</p>}

        {usingRecurringFields && !(isBlockEdit && seriesMetaLoading) && (
          <>
            {target.kind === "create" && (
              <DateOffsetField
                id={`${formId}-starts`}
                label="Starts"
                value={recurringStartOffset}
                onChange={setRecurringStartOffset}
                options={seriesRangeOptions}
                today={today}
              />
            )}

            <div className="grid grid-cols-2 gap-4">
              {target.kind === "create" ? (
                <div className="flex flex-col gap-1.5">
                  <label
                    htmlFor={`${formId}-frequency`}
                    className="text-xs font-medium text-muted-foreground"
                  >
                    Frequency
                  </label>
                  <Select
                    value={frequency}
                    onValueChange={(value) => setFrequency(value as SeriesFrequency)}
                  >
                    <SelectTrigger id={`${formId}-frequency`}>
                      <SelectValue>{(value: SeriesFrequency) => value}</SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {FREQUENCIES.map((f) => (
                        <SelectItem key={f} value={f}>
                          {f}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ) : (
                <ReadOnlyField
                  label="Frequency"
                  value={frequency}
                  caption="Can't be changed after creation."
                />
              )}

              <div className="flex flex-col gap-1.5">
                <label htmlFor={`${formId}-every`} className="text-xs font-medium text-muted-foreground">
                  Every
                </label>
                <Select
                  value={String(intervalCount)}
                  onValueChange={(value) => setIntervalCount(Number(value as string))}
                >
                  <SelectTrigger id={`${formId}-every`}>
                    <SelectValue>
                      {(value: string) => `${value} ${pluralUnit(Number(value), frequencyUnit(frequency))}`}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {EVERY_OPTIONS.map((n) => (
                      <SelectItem key={n} value={String(n)}>
                        {n} {pluralUnit(n, frequencyUnit(frequency))}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {frequency === "Weekly" && (
              <div className="flex flex-col gap-1.5">
                <span className="text-xs font-medium text-muted-foreground">Repeats on</span>
                <div
                  role="group"
                  aria-label="Weekdays"
                  className="grid grid-cols-7 gap-1 rounded-full bg-muted p-1"
                >
                  {WEEKDAY_LABELS.map((label, index) => {
                    const selected = recurringWeekdays.includes(index)
                    return (
                      <button
                        key={label}
                        type="button"
                        aria-pressed={selected}
                        onClick={() => toggleRecurringWeekday(index)}
                        className={cn(
                          "cursor-pointer rounded-full px-1 py-1.5 text-xs font-medium transition-colors duration-200 motion-reduce:transition-none",
                          selected
                            ? "bg-primary text-primary-foreground"
                            : "text-muted-foreground hover:text-foreground"
                        )}
                      >
                        {label}
                      </button>
                    )
                  })}
                </div>
              </div>
            )}

            {frequency === "Monthly" && (
              <div className="flex flex-col gap-1.5">
                <label htmlFor={`${formId}-day-of-month`} className="text-xs font-medium text-muted-foreground">
                  Day of month
                </label>
                <Select
                  value={String(dayOfMonth)}
                  onValueChange={(value) => setDayOfMonth(Number(value as string))}
                >
                  <SelectTrigger id={`${formId}-day-of-month`}>
                    <SelectValue>{(value: string) => ordinal(Number(value))}</SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {DAY_OF_MONTH_OPTIONS.map((d) => (
                      <SelectItem key={d} value={String(d)}>
                        {ordinal(d)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <TimeField
                id={`${formId}-recurring-start`}
                label="Start time"
                value={recurringStartTime}
                onChange={setRecurringStartTime}
              />
              <TimeField
                id={`${formId}-recurring-end`}
                label="End time"
                value={recurringEndTime}
                onChange={setRecurringEndTime}
              />
            </div>

            <DateOffsetField
              id={`${formId}-until`}
              label="Until"
              value={recurringUntilOffset}
              onChange={setRecurringUntilOffset}
              options={seriesRangeOptions}
              today={today}
            />
          </>
        )}

        {error && <p className="text-sm text-destructive">{error}</p>}
      </form>

      <DialogFooter>
        <Button type="button" variant="secondary" onClick={() => onOpenChange(false)} disabled={saving}>
          Cancel
        </Button>
        <Button type="submit" form={formId} disabled={saving}>
          {saving ? "Saving…" : "Save"}
        </Button>
      </DialogFooter>

      {(isBlockEdit || isSeriesEdit) && (
        <div className="mt-4 flex flex-col gap-2 border-t border-border pt-4">
          {deleteError && <p className="text-sm text-destructive">{deleteError}</p>}
          {confirmingDelete ? (
            isBlockPartOfSeries ? (
              <div className="flex flex-col gap-2">
                <p className="text-sm text-foreground">
                  This is part of a recurring rule. Delete just this block, or the whole rule?
                </p>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    className="sm:flex-1"
                    onClick={() => setConfirmingDelete(false)}
                    disabled={deleting}
                  >
                    Keep
                  </Button>
                  <Button
                    type="button"
                    variant="destructive"
                    size="sm"
                    className="sm:flex-1"
                    onClick={() => handleConfirmDelete(false)}
                    disabled={deleting}
                  >
                    {deleting ? "Deleting…" : "Delete this block"}
                  </Button>
                  <Button
                    type="button"
                    variant="destructive"
                    size="sm"
                    className="sm:flex-1"
                    onClick={() => handleConfirmDelete(true)}
                    disabled={deleting}
                  >
                    {deleting ? "Deleting…" : "Delete whole rule"}
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <p className="flex-1 text-sm text-foreground">
                  {isSeriesEdit ? "Delete this whole recurring rule?" : "Delete this working-hours block?"}
                </p>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => setConfirmingDelete(false)}
                  disabled={deleting}
                >
                  Keep
                </Button>
                <Button
                  type="button"
                  variant="destructive"
                  size="sm"
                  onClick={() => handleConfirmDelete(false)}
                  disabled={deleting}
                >
                  {deleting ? "Deleting…" : "Confirm delete"}
                </Button>
              </div>
            )
          ) : (
            <Button
              type="button"
              variant="destructive"
              className="w-full"
              onClick={() => setConfirmingDelete(true)}
            >
              <Trash2 />
              {isSeriesEdit ? "Delete recurring rule" : "Delete working hours"}
            </Button>
          )}
        </div>
      )}
    </>
  )
}
