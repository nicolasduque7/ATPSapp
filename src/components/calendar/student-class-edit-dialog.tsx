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
  addMinutes,
  combineClubDateAndTime,
  combineDateAndTime,
  formatDateOnly,
  parseDateOnly,
  toClubZoned,
  zonedNow,
  type SeriesFrequency,
} from "@/lib/dates"
import { getStudentClassSeriesMeta } from "@/lib/actions/student-classes"
import type { ClassType, Coach, Location } from "@/lib/mock-data"
import type { CalendarClassEvent, StudentClassFormSubmission } from "@/components/calendar/types"
import {
  DAY_OF_MONTH_OPTIONS,
  DateOffsetField,
  EVERY_OPTIONS,
  FREQUENCIES,
  OpenClassField,
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

interface StudentClassEditDialogProps {
  event: CalendarClassEvent | null
  mode: "create" | "edit"
  coaches: Coach[]
  locations: Location[]
  onOpenChange: (open: boolean) => void
  onSave: (submission: StudentClassFormSubmission) => Promise<void>
  onDelete?: (eventId: string, options?: { deleteSeries?: boolean }) => Promise<void>
}

const CLASS_TYPES: ClassType[] = ["Private", "Group", "Match"]

const DATE_RANGE_BEFORE = 14
const DATE_RANGE_AFTER = 90
const SERIES_RANGE_AFTER = 180
const DEFAULT_SERIES_LENGTH_DAYS = 56

function durationBetween(startTime: string, endTime: string, today: Date): number {
  const start = combineDateAndTime(today, startTime)
  const end = combineDateAndTime(today, endTime)
  return Math.round((end.getTime() - start.getTime()) / 60_000)
}

export function StudentClassEditDialog({
  event,
  mode,
  coaches,
  locations,
  onOpenChange,
  onSave,
  onDelete,
}: StudentClassEditDialogProps) {
  return (
    <Dialog open={!!event} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{mode === "create" ? "Book a class" : "Edit class"}</DialogTitle>
        </DialogHeader>

        {event && (
          <StudentClassEditForm
            key={event.id}
            event={event}
            mode={mode}
            coaches={coaches}
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

interface StudentClassEditFormProps {
  event: CalendarClassEvent
  mode: "create" | "edit"
  coaches: Coach[]
  locations: Location[]
  onOpenChange: (open: boolean) => void
  onSave: (submission: StudentClassFormSubmission) => Promise<void>
  onDelete?: (eventId: string, options?: { deleteSeries?: boolean }) => Promise<void>
}

function StudentClassEditForm({
  event,
  mode,
  coaches,
  locations,
  onOpenChange,
  onSave,
  onDelete,
}: StudentClassEditFormProps) {
  const formId = useId()
  const [coachId, setCoachId] = useState<string | null>(
    mode === "create" ? null : event.resource.coachId
  )
  const [locationId, setLocationId] = useState<string | null>(
    mode === "create" ? null : event.resource.locationId
  )
  const [classType, setClassType] = useState<ClassType | null>(
    mode === "create" ? null : event.resource.type
  )
  const [isOpen, setIsOpen] = useState(mode === "create" ? false : event.resource.isOpen)
  const [maxJoiners, setMaxJoiners] = useState(
    mode === "create" ? 1 : (event.resource.maxJoiners ?? 1)
  )
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  const seriesId = event.resource.seriesId ?? null
  const isSeriesInstance = mode === "edit" && !!seriesId

  const [bookingKind, setBookingKind] = useState<"one-off" | "recurring">("one-off")
  const [editScope, setEditScope] = useState<"instance" | "series">("instance")
  const usingRecurringFields =
    (mode === "create" && bookingKind === "recurring") ||
    (mode === "edit" && isSeriesInstance && editScope === "series")

  const today = useMemo(() => startOfDay(zonedNow()), [])
  const initialDateOffset = useMemo(
    () => differenceInCalendarDays(startOfDay(toClubZoned(event.start)), today),
    [event.start, today]
  )

  // Single-date fields: one-off create, or editing just this instance.
  const [dateOffset, setDateOffset] = useState(initialDateOffset)
  const [singleStartTime, setSingleStartTime] = useState(() => toTimeInputValue(toClubZoned(event.start)))
  const [singleEndTime, setSingleEndTime] = useState(() => toTimeInputValue(toClubZoned(event.end)))

  // Recurring-pattern fields: creating a series, or editing the whole series.
  const [recurringStartOffset, setRecurringStartOffset] = useState(initialDateOffset)
  const [frequency, setFrequency] = useState<SeriesFrequency>("Weekly")
  const [intervalCount, setIntervalCount] = useState(1)
  const [recurringWeekdays, setRecurringWeekdays] = useState<number[]>([])
  const [dayOfMonth, setDayOfMonth] = useState(1)
  const [recurringStartTime, setRecurringStartTime] = useState(() => toTimeInputValue(toClubZoned(event.start)))
  const [recurringEndTime, setRecurringEndTime] = useState(() => toTimeInputValue(toClubZoned(event.end)))
  const [recurringUntilOffset, setRecurringUntilOffset] = useState(
    initialDateOffset + DEFAULT_SERIES_LENGTH_DAYS
  )

  const [seriesMetaLoaded, setSeriesMetaLoaded] = useState(false)
  const [seriesMetaError, setSeriesMetaError] = useState<string | null>(null)
  const seriesMetaLoading =
    mode === "edit" && isSeriesInstance && editScope === "series" && !seriesMetaLoaded && !seriesMetaError

  useEffect(() => {
    if (!(mode === "edit" && isSeriesInstance && editScope === "series" && seriesId) || seriesMetaLoaded) {
      return
    }
    let cancelled = false
    getStudentClassSeriesMeta(seriesId)
      .then((meta) => {
        if (cancelled) return
        setFrequency(meta.frequency)
        setIntervalCount(meta.intervalCount)
        setRecurringWeekdays(meta.weekdays ?? [])
        setDayOfMonth(meta.dayOfMonth ?? 1)
        setRecurringStartTime(meta.startTime)
        const start = combineDateAndTime(today, meta.startTime)
        setRecurringEndTime(toTimeInputValue(addMinutes(start, meta.durationMinutes)))
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
  }, [mode, isSeriesInstance, editScope, seriesId, seriesMetaLoaded, today])

  const dateOptions = useMemo(
    () => buildOffsetRange(-DATE_RANGE_BEFORE, DATE_RANGE_AFTER, initialDateOffset),
    [initialDateOffset]
  )
  const seriesRangeOptions = useMemo(
    () => buildOffsetRange(-DATE_RANGE_BEFORE, SERIES_RANGE_AFTER, recurringStartOffset, recurringUntilOffset),
    [recurringStartOffset, recurringUntilOffset]
  )

  function toggleRecurringWeekday(day: number) {
    setRecurringWeekdays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day].sort((a, b) => a - b)
    )
  }

  async function handleSubmit(formEvent: React.FormEvent) {
    formEvent.preventDefault()

    if (!coachId || !locationId || !classType) {
      setError("Select a coach, location, and type.")
      return
    }

    const coach = coaches.find((c) => c.id === coachId)
    const location = locations.find((l) => l.id === locationId)
    if (!coach || !location) return

    if (usingRecurringFields) {
      if (recurringEndTime <= recurringStartTime) {
        setError("End time must be after the start time.")
        return
      }
      const untilBound = mode === "create" ? recurringStartOffset : 0
      if (recurringUntilOffset < untilBound) {
        setError("Until date must be on or after the start date.")
        return
      }
      if (frequency === "Weekly" && recurringWeekdays.length === 0) {
        setError("Select at least one day of the week.")
        return
      }
    } else {
      if (singleEndTime <= singleStartTime) {
        setError("End time must be after the start time.")
        return
      }
    }

    setError(null)
    setSaving(true)
    try {
      if (usingRecurringFields) {
        const durationMinutes = durationBetween(recurringStartTime, recurringEndTime, today)
        const weekdays = frequency === "Weekly" ? recurringWeekdays : null
        const dayOfMonthValue = frequency === "Monthly" ? dayOfMonth : null
        if (mode === "create") {
          await onSave({
            kind: "series-create",
            input: {
              coachId: coach.id,
              locationId: location.id,
              type: classType,
              frequency,
              intervalCount,
              weekdays,
              dayOfMonth: dayOfMonthValue,
              startDate: formatDateOnly(addDays(today, recurringStartOffset)),
              startTime: recurringStartTime,
              durationMinutes,
              endDate: formatDateOnly(addDays(today, recurringUntilOffset)),
            },
          })
        } else if (seriesId) {
          await onSave({
            kind: "series-edit",
            seriesId,
            input: {
              coachId: coach.id,
              locationId: location.id,
              type: classType,
              intervalCount,
              weekdays,
              dayOfMonth: dayOfMonthValue,
              startTime: recurringStartTime,
              durationMinutes,
              endDate: formatDateOnly(addDays(today, recurringUntilOffset)),
            },
          })
        }
      } else {
        const day = addDays(today, dateOffset)
        const start = combineClubDateAndTime(day, singleStartTime)
        const end = combineClubDateAndTime(day, singleEndTime)
        const input = {
          coachId: coach.id,
          locationId: location.id,
          type: classType,
          startTime: start,
          endTime: end,
          durationMinutes: Math.round((end.getTime() - start.getTime()) / 60_000),
          isOpen,
          maxJoiners: isOpen ? maxJoiners : null,
        }
        await onSave(mode === "create" ? { kind: "one-off", input } : { kind: "instance-edit", input })
      }
      onOpenChange(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Try again.")
    } finally {
      setSaving(false)
    }
  }

  async function handleConfirmDelete(deleteSeries: boolean) {
    if (!onDelete) return
    setDeleteError(null)
    setDeleting(true)
    try {
      await onDelete(event.id, { deleteSeries })
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : "Couldn't delete class. Try again.")
      setDeleting(false)
    }
  }

  return (
    <>
      <form id={formId} onSubmit={handleSubmit} className="mt-4 flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <label htmlFor={`${formId}-coach`} className="text-xs font-medium text-muted-foreground">
            Coach
          </label>
          <Select value={coachId} onValueChange={(value) => setCoachId(value as string)}>
            <SelectTrigger id={`${formId}-coach`}>
              <SelectValue>
                {(value: string | null) => {
                  const c = coaches.find((coach) => coach.id === value)
                  if (!c) return <span className="text-muted-foreground">Select a coach</span>
                  return c.name
                }}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {coaches.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-muted-foreground">Location</span>
          <div role="radiogroup" aria-label="Location" className="flex flex-wrap gap-2">
            {locations.map((location) => {
              const style = getLocationColorStyle(location.id, locations)
              const selected = location.id === locationId
              return (
                <button
                  key={location.id}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  onClick={() => setLocationId(location.id)}
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

        <div className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-muted-foreground">Type</span>
          <div role="radiogroup" aria-label="Type" className="grid grid-cols-3 gap-1 rounded-full bg-muted p-1">
            {CLASS_TYPES.map((t) => (
              <button
                key={t}
                type="button"
                role="radio"
                aria-checked={classType === t}
                onClick={() => setClassType(t)}
                className={cn(
                  "cursor-pointer rounded-full px-3 py-1.5 text-sm font-medium transition-colors duration-200 motion-reduce:transition-none",
                  classType === t
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        {mode === "create" && (
          <div className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-muted-foreground">Booking type</span>
            <SegmentedToggle
              ariaLabel="Booking type"
              value={bookingKind}
              onChange={setBookingKind}
              options={[
                { value: "one-off", label: "One-off" },
                { value: "recurring", label: "Recurring" },
              ]}
            />
          </div>
        )}

        {mode === "edit" && isSeriesInstance && (
          <div className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-muted-foreground">Applies to</span>
            <SegmentedToggle
              ariaLabel="Applies to"
              value={editScope}
              onChange={setEditScope}
              options={[
                { value: "instance", label: "This class" },
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
            <OpenClassField
              isOpen={isOpen}
              onIsOpenChange={setIsOpen}
              maxJoiners={maxJoiners}
              onMaxJoinersChange={setMaxJoiners}
            />
          </>
        )}

        {usingRecurringFields && mode === "edit" && seriesMetaLoading && (
          <p className="text-sm text-muted-foreground">Loading series details…</p>
        )}
        {seriesMetaError && <p className="text-sm text-destructive">{seriesMetaError}</p>}

        {usingRecurringFields && !(mode === "edit" && seriesMetaLoading) && (
          <>
            {mode === "create" && (
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
              {mode === "create" ? (
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

      {mode === "edit" && (
        <div className="mt-4 flex flex-col gap-2 border-t border-border pt-4">
          {deleteError && <p className="text-sm text-destructive">{deleteError}</p>}
          {confirmingDelete ? (
            seriesId ? (
              <div className="flex flex-col gap-2">
                <p className="text-sm text-foreground">
                  This class is part of a recurring series. Delete just this class, or the whole series?
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
                    Keep class
                  </Button>
                  <Button
                    type="button"
                    variant="destructive"
                    size="sm"
                    className="sm:flex-1"
                    onClick={() => handleConfirmDelete(false)}
                    disabled={deleting}
                  >
                    {deleting ? "Deleting…" : "Delete this class"}
                  </Button>
                  <Button
                    type="button"
                    variant="destructive"
                    size="sm"
                    className="sm:flex-1"
                    onClick={() => handleConfirmDelete(true)}
                    disabled={deleting}
                  >
                    {deleting ? "Deleting…" : "Delete whole series"}
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <p className="flex-1 text-sm text-foreground">Delete this class?</p>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => setConfirmingDelete(false)}
                  disabled={deleting}
                >
                  Keep class
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
              Delete class
            </Button>
          )}
        </div>
      )}
    </>
  )
}
