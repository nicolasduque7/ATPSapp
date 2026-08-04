"use client"

import { useEffect, useId, useMemo, useState } from "react"
import { differenceInCalendarDays, startOfDay } from "date-fns"
import { Trash2 } from "lucide-react"
import { useLocale, useTranslations } from "next-intl"

import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  Combobox,
  ComboboxContent,
  ComboboxIcon,
  ComboboxInput,
  ComboboxInputGroup,
  ComboboxItem,
  ComboboxList,
} from "@/components/ui/combobox"
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
import { getClassSeriesMeta } from "@/lib/actions/classes"
import type { ClassType, Location, Student } from "@/lib/mock-data"
import type { CalendarClassEvent, ClassFormSubmission } from "@/components/calendar/types"
import { AvailableSlotsPanel } from "@/components/calendar/available-slots-panel"
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
  frequencyUnitLabel,
  ordinal,
  toTimeInputValue,
  weekdayShortLabel,
} from "@/components/calendar/recurrence-fields"
import { StudentMultiSelectField } from "@/components/calendar/student-multi-select-field"

const MAX_STUDENTS = 8

interface ClassEditDialogProps {
  event: CalendarClassEvent | null
  mode: "create" | "edit"
  currentCoachId: string
  students: Student[]
  locations: Location[]
  onOpenChange: (open: boolean) => void
  onSave: (submission: ClassFormSubmission) => Promise<void>
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
      coachId: "",
      coachName: "",
      studentId: "",
      studentName: "",
      level: "1ra",
      locationId: "",
      locationName: "",
      durationMinutes: 60,
      type: "Private",
      seriesId: null,
      isOpen: false,
      maxJoiners: null,
      participantStudentIds: [],
      participantNames: [],
    },
  }
}

export function ClassEditDialog({
  event,
  mode,
  currentCoachId,
  students,
  locations,
  onOpenChange,
  onSave,
  onDelete,
}: ClassEditDialogProps) {
  const t = useTranslations("classForm")
  return (
    <Dialog open={!!event} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{mode === "create" ? t("addClassTitle") : t("editClassTitle")}</DialogTitle>
        </DialogHeader>

        {event && (
          <ClassEditForm
            key={event.id}
            event={event}
            mode={mode}
            currentCoachId={currentCoachId}
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
  currentCoachId: string
  students: Student[]
  locations: Location[]
  onOpenChange: (open: boolean) => void
  onSave: (submission: ClassFormSubmission) => Promise<void>
  onDelete?: (eventId: string, options?: { deleteSeries?: boolean }) => Promise<void>
}

function ClassEditForm({
  event,
  mode,
  currentCoachId,
  students,
  locations,
  onOpenChange,
  onSave,
  onDelete,
}: ClassEditFormProps) {
  const t = useTranslations("classForm")
  const te = useTranslations("enums.classType")
  const tf = useTranslations("enums.frequency")
  const tr = useTranslations("recurrence")
  const locale = useLocale()
  const formId = useId()
  const [studentIds, setStudentIds] = useState<string[]>(
    mode === "create" ? [] : [event.resource.studentId, ...event.resource.participantStudentIds]
  )
  // The Private picker's search text — mirrors the currently selected
  // student's label at rest, like a normal single-select, but stays
  // locally owned (see the comment on the Combobox below for why).
  const [studentQuery, setStudentQuery] = useState(() => {
    if (mode === "create") return ""
    const s = students.find((student) => student.id === event.resource.studentId)
    return s ? `${s.name} · ${s.level}` : ""
  })
  const [locationId, setLocationId] = useState<string | null>(
    mode === "create" ? null : event.resource.locationId
  )
  const [classType, setClassType] = useState<ClassType | null>(
    mode === "create" ? null : event.resource.type
  )

  function handleClassTypeChange(next: ClassType) {
    setClassType(next)
    if (next === "Private") {
      setStudentIds((prev) => prev.slice(0, 1))
    }
  }

  function toggleStudent(id: string) {
    if (classType === "Private") {
      setStudentIds([id])
      return
    }
    setStudentIds((prev) => {
      if (prev.includes(id)) return prev.filter((sid) => sid !== id)
      if (prev.length >= MAX_STUDENTS) return prev
      return [...prev, id]
    })
  }
  const [isOpen, setIsOpen] = useState(mode === "create" ? false : event.resource.isOpen)
  const [maxJoiners, setMaxJoiners] = useState(
    mode === "create" ? 1 : (event.resource.maxJoiners ?? 1)
  )
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  // Deactivated students/locations stay out of the pickers for new
  // selections, but a class already booked against one keeps showing it so
  // editing that class doesn't break.
  const visibleStudents = useMemo(
    () => students.filter((s) => !s.deactivatedAt || studentIds.includes(s.id)),
    [students, studentIds]
  )
  const visibleLocations = useMemo(
    () => locations.filter((l) => !l.deactivatedAt || l.id === locationId),
    [locations, locationId]
  )

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
        setRecurringUntilOffset(differenceInCalendarDays(parseDateOnly(meta.endDate), today))
        setSeriesMetaLoaded(true)
      })
      .catch((err) => {
        if (!cancelled) {
          setSeriesMetaError(err instanceof Error ? err.message : t("errorLoadSeries"))
        }
      })
    return () => {
      cancelled = true
    }
  }, [mode, isSeriesInstance, editScope, seriesId, seriesMetaLoaded, today, t])

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

    if (studentIds.length === 0 || !locationId || !classType) {
      setError(t("errorSelectAll"))
      return
    }

    const location = locations.find((l) => l.id === locationId)
    if (!location) return

    if (usingRecurringFields) {
      if (recurringEndTime <= recurringStartTime) {
        setError(t("errorEndAfterStart"))
        return
      }
      const untilBound = mode === "create" ? recurringStartOffset : 0
      if (recurringUntilOffset < untilBound) {
        setError(t("errorUntilAfterStart"))
        return
      }
      if (frequency === "Weekly" && recurringWeekdays.length === 0) {
        setError(t("errorSelectWeekday"))
        return
      }
    } else {
      if (singleEndTime <= singleStartTime) {
        setError(t("errorEndAfterStart"))
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
              studentIds,
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
              studentIds,
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
          studentIds,
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
      setError(err instanceof Error ? err.message : t("errorGeneric"))
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
      setDeleteError(err instanceof Error ? err.message : t("errorDeleteGeneric"))
      setDeleting(false)
    }
  }

  return (
    <>
      <form id={formId} onSubmit={handleSubmit} className="mt-4 flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-muted-foreground">{t("type")}</span>
          <div role="radiogroup" aria-label={t("type")} className="grid grid-cols-3 gap-1 rounded-full bg-muted p-1">
            {CLASS_TYPES.map((classTypeOption) => (
              <button
                key={classTypeOption}
                type="button"
                role="radio"
                aria-checked={classType === classTypeOption}
                onClick={() => handleClassTypeChange(classTypeOption)}
                className={cn(
                  "cursor-pointer rounded-full px-3 py-1.5 text-sm font-medium transition-colors duration-200 motion-reduce:transition-none",
                  classType === classTypeOption
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {te(classTypeOption)}
              </button>
            ))}
          </div>
        </div>

        {classType === "Private" || classType === null ? (
          <div className="flex flex-col gap-1.5">
            <label htmlFor={`${formId}-student`} className="text-xs font-medium text-muted-foreground">
              {t("student")}
            </label>
            <Combobox
              value={visibleStudents.find((s) => s.id === studentIds[0]) ?? null}
              onValueChange={(student: Student | null, eventDetails: { reason: string }) => {
                // Ignore Escape/outside-click/blur clears — only an actual
                // item pick should change the selection.
                if (eventDetails.reason !== "item-press") return
                setStudentIds(student ? [student.id] : [])
                setStudentQuery(student ? `${student.name} · ${student.level}` : "")
              }}
              inputValue={studentQuery}
              onInputValueChange={setStudentQuery}
              isItemEqualToValue={(a: Student, b: Student) => a.id === b.id}
            >
              <ComboboxInputGroup>
                <ComboboxInput id={`${formId}-student`} placeholder={t("selectStudent")} />
                <ComboboxIcon />
              </ComboboxInputGroup>
              <ComboboxContent>
                {(() => {
                  const normalizedQuery = studentQuery.trim().toLowerCase()
                  const filtered = normalizedQuery
                    ? visibleStudents.filter((s) => `${s.name} · ${s.level}`.toLowerCase().includes(normalizedQuery))
                    : visibleStudents
                  if (filtered.length === 0) {
                    return <p className="px-2.5 py-2 text-sm text-muted-foreground">{t("noStudentsFound")}</p>
                  }
                  return (
                    <ComboboxList>
                      {filtered.map((s) => (
                        <ComboboxItem key={s.id} value={s}>
                          {s.name} · {s.level}
                        </ComboboxItem>
                      ))}
                    </ComboboxList>
                  )
                })()}
              </ComboboxContent>
            </Combobox>
          </div>
        ) : (
          <StudentMultiSelectField
            id={`${formId}-students`}
            label={t("students")}
            options={visibleStudents}
            selectedIds={studentIds}
            onToggle={toggleStudent}
            maxCount={MAX_STUDENTS}
            showHostBadge
            hostLabel={t("host")}
          />
        )}

        <div className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-muted-foreground">{t("location")}</span>
          <div role="radiogroup" aria-label={t("location")} className="flex flex-wrap gap-2">
            {visibleLocations.map((location) => {
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

        {mode === "create" && (
          <div className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-muted-foreground">{t("bookingType")}</span>
            <SegmentedToggle
              ariaLabel={t("bookingType")}
              value={bookingKind}
              onChange={setBookingKind}
              options={[
                { value: "one-off", label: t("oneTimeClass") },
                { value: "recurring", label: t("recurring") },
              ]}
            />
          </div>
        )}

        {mode === "edit" && isSeriesInstance && (
          <div className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-muted-foreground">{t("appliesTo")}</span>
            <SegmentedToggle
              ariaLabel={t("appliesTo")}
              value={editScope}
              onChange={setEditScope}
              options={[
                { value: "instance", label: t("thisClass") },
                { value: "series", label: t("wholeSeries") },
              ]}
            />
          </div>
        )}

        {!(mode === "edit" && seriesMetaLoading) && (
          <AvailableSlotsPanel
            coachId={currentCoachId}
            locationId={locationId}
            anchorDateOffset={usingRecurringFields ? recurringStartOffset : dateOffset}
            durationMinutes={
              usingRecurringFields
                ? durationBetween(recurringStartTime, recurringEndTime, today)
                : durationBetween(singleStartTime, singleEndTime, today)
            }
            today={today}
            excludeClassId={mode === "edit" && !usingRecurringFields ? event.id : undefined}
            excludeSeriesId={mode === "edit" && usingRecurringFields ? (seriesId ?? undefined) : undefined}
            onPickSlot={({ dateOffset: pickedOffset, startTime, endTime }) => {
              if (usingRecurringFields) {
                setRecurringStartOffset(pickedOffset)
                setRecurringStartTime(startTime)
                setRecurringEndTime(endTime)
              } else {
                setDateOffset(pickedOffset)
                setSingleStartTime(startTime)
                setSingleEndTime(endTime)
              }
            }}
          />
        )}

        {!usingRecurringFields && (
          <>
            <DateOffsetField
              id={`${formId}-date`}
              label={t("date")}
              value={dateOffset}
              onChange={setDateOffset}
              options={dateOptions}
              today={today}
            />
            <div className="grid grid-cols-2 gap-4">
              <TimeField
                id={`${formId}-start`}
                label={t("startTime")}
                value={singleStartTime}
                onChange={setSingleStartTime}
              />
              <TimeField
                id={`${formId}-end`}
                label={t("endTime")}
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
          <p className="text-sm text-muted-foreground">{t("loadingSeries")}</p>
        )}
        {seriesMetaError && <p className="text-sm text-destructive">{seriesMetaError}</p>}

        {usingRecurringFields && !(mode === "edit" && seriesMetaLoading) && (
          <>
            {mode === "create" && (
              <DateOffsetField
                id={`${formId}-starts`}
                label={t("starts")}
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
                    {t("frequency")}
                  </label>
                  <Select
                    value={frequency}
                    onValueChange={(value) => setFrequency(value as SeriesFrequency)}
                  >
                    <SelectTrigger id={`${formId}-frequency`}>
                      <SelectValue>{(value: SeriesFrequency) => tf(value)}</SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {FREQUENCIES.map((f) => (
                        <SelectItem key={f} value={f}>
                          {tf(f)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ) : (
                <ReadOnlyField
                  label={t("frequency")}
                  value={tf(frequency)}
                  caption={t("frequencyLocked")}
                />
              )}

              <div className="flex flex-col gap-1.5">
                <label htmlFor={`${formId}-every`} className="text-xs font-medium text-muted-foreground">
                  {t("every")}
                </label>
                <Select
                  value={String(intervalCount)}
                  onValueChange={(value) => setIntervalCount(Number(value as string))}
                >
                  <SelectTrigger id={`${formId}-every`}>
                    <SelectValue>
                      {(value: string) => `${value} ${frequencyUnitLabel(frequency, Number(value), tr)}`}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {EVERY_OPTIONS.map((n) => (
                      <SelectItem key={n} value={String(n)}>
                        {n} {frequencyUnitLabel(frequency, n, tr)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {frequency === "Weekly" && (
              <div className="flex flex-col gap-1.5">
                <span className="text-xs font-medium text-muted-foreground">{t("repeatsOn")}</span>
                <div
                  role="group"
                  aria-label={t("weekdays")}
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
                        {weekdayShortLabel(index, tr)}
                      </button>
                    )
                  })}
                </div>
              </div>
            )}

            {frequency === "Monthly" && (
              <div className="flex flex-col gap-1.5">
                <label htmlFor={`${formId}-day-of-month`} className="text-xs font-medium text-muted-foreground">
                  {t("dayOfMonth")}
                </label>
                <Select
                  value={String(dayOfMonth)}
                  onValueChange={(value) => setDayOfMonth(Number(value as string))}
                >
                  <SelectTrigger id={`${formId}-day-of-month`}>
                    <SelectValue>{(value: string) => ordinal(Number(value), locale)}</SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {DAY_OF_MONTH_OPTIONS.map((d) => (
                      <SelectItem key={d} value={String(d)}>
                        {ordinal(d, locale)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <TimeField
                id={`${formId}-recurring-start`}
                label={t("startTime")}
                value={recurringStartTime}
                onChange={setRecurringStartTime}
              />
              <TimeField
                id={`${formId}-recurring-end`}
                label={t("endTime")}
                value={recurringEndTime}
                onChange={setRecurringEndTime}
              />
            </div>

            <DateOffsetField
              id={`${formId}-until`}
              label={t("until")}
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
          {t("cancel")}
        </Button>
        <Button type="submit" form={formId} disabled={saving}>
          {saving ? t("saving") : t("save")}
        </Button>
      </DialogFooter>

      {mode === "edit" && (
        <div className="mt-4 flex flex-col gap-2 border-t border-border pt-4">
          {deleteError && <p className="text-sm text-destructive">{deleteError}</p>}
          {confirmingDelete ? (
            seriesId ? (
              <div className="flex flex-col gap-2">
                <p className="text-sm text-foreground">{t("deleteSeriesQuestion")}</p>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    className="sm:flex-1"
                    onClick={() => setConfirmingDelete(false)}
                    disabled={deleting}
                  >
                    {t("keepClass")}
                  </Button>
                  <Button
                    type="button"
                    variant="destructive"
                    size="sm"
                    className="sm:flex-1"
                    onClick={() => handleConfirmDelete(false)}
                    disabled={deleting}
                  >
                    {deleting ? t("deleting") : t("deleteThisClass")}
                  </Button>
                  <Button
                    type="button"
                    variant="destructive"
                    size="sm"
                    className="sm:flex-1"
                    onClick={() => handleConfirmDelete(true)}
                    disabled={deleting}
                  >
                    {deleting ? t("deleting") : t("deleteWholeSeries")}
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <p className="flex-1 text-sm text-foreground">{t("deleteThisClassQuestion")}</p>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => setConfirmingDelete(false)}
                  disabled={deleting}
                >
                  {t("keepClass")}
                </Button>
                <Button
                  type="button"
                  variant="destructive"
                  size="sm"
                  onClick={() => handleConfirmDelete(false)}
                  disabled={deleting}
                >
                  {deleting ? t("deleting") : t("confirmDelete")}
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
              {t("deleteClass")}
            </Button>
          )}
        </div>
      )}
    </>
  )
}
