"use client"

import { useEffect, useId, useMemo, useState } from "react"
import { addDays as addCalendarDays, differenceInCalendarDays, format, startOfDay } from "date-fns"
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
import { addDays, addMinutes, combineDateAndTime, type SeriesFrequency } from "@/lib/dates"
import { getClassSeriesMeta } from "@/lib/actions/classes"
import type { ClassType, Location, Student } from "@/lib/mock-data"
import type { CalendarClassEvent, ClassFormSubmission } from "@/components/calendar/types"

interface ClassEditDialogProps {
  event: CalendarClassEvent | null
  mode: "create" | "edit"
  students: Student[]
  locations: Location[]
  onOpenChange: (open: boolean) => void
  onSave: (submission: ClassFormSubmission) => Promise<void>
  onDelete?: (eventId: string, options?: { deleteSeries?: boolean }) => Promise<void>
}

const CLASS_TYPES: ClassType[] = ["Private", "Group", "Match"]
const WEEKDAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
const FREQUENCIES: SeriesFrequency[] = ["Daily", "Weekly", "Monthly"]
const EVERY_OPTIONS = Array.from({ length: 12 }, (_, i) => i + 1)
const DAY_OF_MONTH_OPTIONS = Array.from({ length: 30 }, (_, i) => i + 1)

const DATE_RANGE_BEFORE = 14
const DATE_RANGE_AFTER = 90
const SERIES_RANGE_AFTER = 180
const DEFAULT_SERIES_LENGTH_DAYS = 56

function buildTimeOptions(): Array<{ value: string; label: string }> {
  const options: Array<{ value: string; label: string }> = []
  for (let minutes = 6 * 60; minutes <= 22 * 60; minutes += 15) {
    const hours = Math.floor(minutes / 60)
    const mins = minutes % 60
    const value = `${hours.toString().padStart(2, "0")}:${mins.toString().padStart(2, "0")}`
    const label = format(new Date(1970, 0, 1, hours, mins), "h:mm a")
    options.push({ value, label })
  }
  return options
}

const TIME_OPTIONS = buildTimeOptions()

function getTimeLabel(value: string): string {
  return TIME_OPTIONS.find((option) => option.value === value)?.label ?? value
}

function toTimeInputValue(date: Date): string {
  return `${date.getHours().toString().padStart(2, "0")}:${date
    .getMinutes()
    .toString()
    .padStart(2, "0")}`
}

function formatDateOffsetLabel(offset: number, today: Date): string {
  const date = addCalendarDays(today, offset)
  if (offset === 0) return `Today · ${format(date, "MMM d")}`
  if (offset === 1) return `Tomorrow · ${format(date, "MMM d")}`
  if (offset === -1) return `Yesterday · ${format(date, "MMM d")}`
  return format(date, "EEE · MMM d")
}

function buildOffsetRange(min: number, max: number, ...mustInclude: number[]): number[] {
  const lo = Math.min(min, ...mustInclude)
  const hi = Math.max(max, ...mustInclude)
  const offsets: number[] = []
  for (let offset = lo; offset <= hi; offset++) offsets.push(offset)
  return offsets
}

function durationBetween(startTime: string, endTime: string, today: Date): number {
  const start = combineDateAndTime(today, startTime)
  const end = combineDateAndTime(today, endTime)
  return Math.round((end.getTime() - start.getTime()) / 60_000)
}

function pluralUnit(n: number, singular: string): string {
  return n === 1 ? singular : `${singular}s`
}

function frequencyUnit(frequency: SeriesFrequency): string {
  switch (frequency) {
    case "Daily":
      return "day"
    case "Weekly":
      return "week"
    case "Monthly":
      return "month"
  }
}

function ordinal(n: number): string {
  const rem100 = n % 100
  if (rem100 >= 11 && rem100 <= 13) return `${n}th`
  switch (n % 10) {
    case 1:
      return `${n}st`
    case 2:
      return `${n}nd`
    case 3:
      return `${n}rd`
    default:
      return `${n}th`
  }
}

export function createDraftEvent(): CalendarClassEvent {
  const now = new Date()
  const start = new Date(now)
  start.setMinutes(start.getMinutes() < 30 ? 30 : 0, 0, 0)
  if (start.getMinutes() === 0) start.setHours(start.getHours() + 1)
  const end = addMinutes(start, 60)

  return {
    id: "draft",
    title: "",
    start,
    end,
    resource: {
      studentId: "",
      studentName: "",
      level: "1ra",
      locationId: "",
      locationName: "",
      durationMinutes: 60,
      type: "Private",
      seriesId: null,
    },
  }
}

export function ClassEditDialog({
  event,
  mode,
  students,
  locations,
  onOpenChange,
  onSave,
  onDelete,
}: ClassEditDialogProps) {
  return (
    <Dialog open={!!event} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{mode === "create" ? "Add class" : "Edit class"}</DialogTitle>
        </DialogHeader>

        {event && (
          <ClassEditForm
            key={event.id}
            event={event}
            mode={mode}
            students={students}
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

interface ClassEditFormProps {
  event: CalendarClassEvent
  mode: "create" | "edit"
  students: Student[]
  locations: Location[]
  onOpenChange: (open: boolean) => void
  onSave: (submission: ClassFormSubmission) => Promise<void>
  onDelete?: (eventId: string, options?: { deleteSeries?: boolean }) => Promise<void>
}

function ClassEditForm({
  event,
  mode,
  students,
  locations,
  onOpenChange,
  onSave,
  onDelete,
}: ClassEditFormProps) {
  const formId = useId()
  const [studentId, setStudentId] = useState<string | null>(
    mode === "create" ? null : event.resource.studentId
  )
  const [locationId, setLocationId] = useState<string | null>(
    mode === "create" ? null : event.resource.locationId
  )
  const [classType, setClassType] = useState<ClassType | null>(
    mode === "create" ? null : event.resource.type
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

  const today = useMemo(() => startOfDay(new Date()), [])
  const initialDateOffset = useMemo(
    () => differenceInCalendarDays(startOfDay(event.start), today),
    [event.start, today]
  )

  // Single-date fields: one-off create, or editing just this instance.
  const [dateOffset, setDateOffset] = useState(initialDateOffset)
  const [singleStartTime, setSingleStartTime] = useState(() => toTimeInputValue(event.start))
  const [singleEndTime, setSingleEndTime] = useState(() => toTimeInputValue(event.end))

  // Recurring-pattern fields: creating a series, or editing the whole series.
  const [recurringStartOffset, setRecurringStartOffset] = useState(initialDateOffset)
  const [frequency, setFrequency] = useState<SeriesFrequency>("Weekly")
  const [intervalCount, setIntervalCount] = useState(1)
  const [recurringWeekdays, setRecurringWeekdays] = useState<number[]>([])
  const [dayOfMonth, setDayOfMonth] = useState(1)
  const [recurringStartTime, setRecurringStartTime] = useState(() => toTimeInputValue(event.start))
  const [recurringEndTime, setRecurringEndTime] = useState(() => toTimeInputValue(event.end))
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
    getClassSeriesMeta(seriesId)
      .then((meta) => {
        if (cancelled) return
        setFrequency(meta.frequency)
        setIntervalCount(meta.intervalCount)
        setRecurringWeekdays(meta.weekdays ?? [])
        setDayOfMonth(meta.dayOfMonth ?? 1)
        setRecurringStartTime(meta.startTime)
        const start = combineDateAndTime(today, meta.startTime)
        setRecurringEndTime(toTimeInputValue(addMinutes(start, meta.durationMinutes)))
        setRecurringUntilOffset(differenceInCalendarDays(meta.endDate, today))
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

    if (!studentId || !locationId || !classType) {
      setError("Select a student, location, and type.")
      return
    }

    const student = students.find((s) => s.id === studentId)
    const location = locations.find((l) => l.id === locationId)
    if (!student || !location) return

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
              studentId: student.id,
              locationId: location.id,
              type: classType,
              frequency,
              intervalCount,
              weekdays,
              dayOfMonth: dayOfMonthValue,
              startDate: addDays(today, recurringStartOffset),
              startTime: recurringStartTime,
              durationMinutes,
              endDate: addDays(today, recurringUntilOffset),
            },
          })
        } else if (seriesId) {
          await onSave({
            kind: "series-edit",
            seriesId,
            input: {
              studentId: student.id,
              locationId: location.id,
              type: classType,
              intervalCount,
              weekdays,
              dayOfMonth: dayOfMonthValue,
              startTime: recurringStartTime,
              durationMinutes,
              endDate: addDays(today, recurringUntilOffset),
            },
          })
        }
      } else {
        const day = addDays(today, dateOffset)
        const start = combineDateAndTime(day, singleStartTime)
        const end = combineDateAndTime(day, singleEndTime)
        const input = {
          studentId: student.id,
          locationId: location.id,
          type: classType,
          startTime: start,
          endTime: end,
          durationMinutes: Math.round((end.getTime() - start.getTime()) / 60_000),
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
          <label htmlFor={`${formId}-student`} className="text-xs font-medium text-muted-foreground">
            Student
          </label>
          <Select value={studentId} onValueChange={(value) => setStudentId(value as string)}>
            <SelectTrigger id={`${formId}-student`}>
              <SelectValue>
                {(value: string | null) => {
                  const s = students.find((student) => student.id === value)
                  if (!s) return <span className="text-muted-foreground">Select a student</span>
                  return `${s.name} · ${s.level}`
                }}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {students.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.name} · {s.level}
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

interface SegmentedToggleProps<T extends string> {
  ariaLabel: string
  value: T
  onChange: (value: T) => void
  options: Array<{ value: T; label: string }>
}

function SegmentedToggle<T extends string>({ ariaLabel, value, onChange, options }: SegmentedToggleProps<T>) {
  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className="grid gap-1 rounded-full bg-muted p-1"
      style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}
    >
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          role="radio"
          aria-checked={value === option.value}
          onClick={() => onChange(option.value)}
          className={cn(
            "cursor-pointer rounded-full px-3 py-1.5 text-sm font-medium transition-colors duration-200 motion-reduce:transition-none",
            value === option.value
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}

interface DateOffsetFieldProps {
  id: string
  label: string
  value: number
  onChange: (offset: number) => void
  options: number[]
  today: Date
}

function DateOffsetField({ id, label, value, onChange, options, today }: DateOffsetFieldProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-xs font-medium text-muted-foreground">
        {label}
      </label>
      <Select value={String(value)} onValueChange={(v) => onChange(Number(v as string))}>
        <SelectTrigger id={id}>
          <SelectValue>{(v: string) => formatDateOffsetLabel(Number(v), today)}</SelectValue>
        </SelectTrigger>
        <SelectContent>
          {options.map((offset) => (
            <SelectItem key={offset} value={String(offset)}>
              {formatDateOffsetLabel(offset, today)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}

interface TimeFieldProps {
  id: string
  label: string
  value: string
  onChange: (value: string) => void
}

function TimeField({ id, label, value, onChange }: TimeFieldProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-xs font-medium text-muted-foreground">
        {label}
      </label>
      <Select value={value} onValueChange={(v) => onChange(v as string)}>
        <SelectTrigger id={id}>
          <SelectValue>{(v: string) => getTimeLabel(v)}</SelectValue>
        </SelectTrigger>
        <SelectContent>
          {TIME_OPTIONS.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}

interface ReadOnlyFieldProps {
  label: string
  value: string
  caption?: string
}

function ReadOnlyField({ label, value, caption }: ReadOnlyFieldProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <div className="flex h-9 items-center rounded-xl border border-input bg-muted px-3 text-sm text-foreground">
        {value}
      </div>
      {caption && <span className="text-[0.7rem] text-muted-foreground">{caption}</span>}
    </div>
  )
}
