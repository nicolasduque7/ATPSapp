"use client"

import { useId, useMemo, useState } from "react"
import { addDays, differenceInCalendarDays, format, startOfDay } from "date-fns"
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
import type { ClassType, Location, Student } from "@/lib/mock-data"
import type { CalendarClassEvent } from "@/components/calendar/types"

interface ClassEditDialogProps {
  event: CalendarClassEvent | null
  students: Student[]
  locations: Location[]
  onOpenChange: (open: boolean) => void
  onSave: (event: CalendarClassEvent) => void
  onDelete: (eventId: string) => void
}

const CLASS_TYPES: ClassType[] = ["Private", "Group", "Match"]

const DATE_RANGE_BEFORE = 14
const DATE_RANGE_AFTER = 90

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

function applyTimeToDate(base: Date, time: string): Date {
  const [hours, minutes] = time.split(":").map(Number)
  const next = new Date(base)
  next.setHours(hours, minutes, 0, 0)
  return next
}

function formatDateOffsetLabel(offset: number, today: Date): string {
  const date = addDays(today, offset)
  if (offset === 0) return `Today · ${format(date, "MMM d")}`
  if (offset === 1) return `Tomorrow · ${format(date, "MMM d")}`
  if (offset === -1) return `Yesterday · ${format(date, "MMM d")}`
  return format(date, "EEE · MMM d")
}

export function ClassEditDialog({
  event,
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
          <DialogTitle>Edit class</DialogTitle>
        </DialogHeader>

        {event && (
          <ClassEditForm
            key={event.id}
            event={event}
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
  students: Student[]
  locations: Location[]
  onOpenChange: (open: boolean) => void
  onSave: (event: CalendarClassEvent) => void
  onDelete: (eventId: string) => void
}

function ClassEditForm({ event, students, locations, onOpenChange, onSave, onDelete }: ClassEditFormProps) {
  const formId = useId()
  const [studentId, setStudentId] = useState(event.resource.studentId)
  const [locationId, setLocationId] = useState(event.resource.locationId)
  const [classType, setClassType] = useState<ClassType>(event.resource.type)
  const [startTime, setStartTime] = useState(() => toTimeInputValue(event.start))
  const [endTime, setEndTime] = useState(() => toTimeInputValue(event.end))
  const [error, setError] = useState<string | null>(null)
  const [confirmingDelete, setConfirmingDelete] = useState(false)

  const today = useMemo(() => startOfDay(new Date()), [])
  const initialDateOffset = useMemo(
    () => differenceInCalendarDays(startOfDay(event.start), today),
    [event.start, today]
  )
  const [dateOffset, setDateOffset] = useState(initialDateOffset)

  const dateOptions = useMemo(() => {
    const min = Math.min(-DATE_RANGE_BEFORE, initialDateOffset)
    const max = Math.max(DATE_RANGE_AFTER, initialDateOffset)
    const offsets: number[] = []
    for (let offset = min; offset <= max; offset++) offsets.push(offset)
    return offsets
  }, [initialDateOffset])

  function handleSubmit(formEvent: React.FormEvent) {
    formEvent.preventDefault()

    const student = students.find((s) => s.id === studentId)
    const location = locations.find((l) => l.id === locationId)
    if (!student || !location) return

    const day = addDays(today, dateOffset)
    const start = applyTimeToDate(day, startTime)
    const end = applyTimeToDate(day, endTime)

    if (end <= start) {
      setError("End time must be after the start time.")
      return
    }

    onSave({
      ...event,
      title: student.name,
      start,
      end,
      resource: {
        studentId: student.id,
        studentName: student.name,
        level: student.level,
        locationId: location.id,
        locationName: location.name,
        durationMinutes: Math.round((end.getTime() - start.getTime()) / 60_000),
        type: classType,
      },
    })
    onOpenChange(false)
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
                {(value: string) => {
                  const s = students.find((student) => student.id === value)
                  return s ? `${s.name} · ${s.level}` : ""
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

        <div className="flex flex-col gap-1.5">
          <label htmlFor={`${formId}-date`} className="text-xs font-medium text-muted-foreground">
            Date
          </label>
          <Select
            value={String(dateOffset)}
            onValueChange={(value) => setDateOffset(Number(value as string))}
          >
            <SelectTrigger id={`${formId}-date`}>
              <SelectValue>{(value: string) => formatDateOffsetLabel(Number(value), today)}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {dateOptions.map((offset) => (
                <SelectItem key={offset} value={String(offset)}>
                  {formatDateOffsetLabel(offset, today)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="flex flex-col gap-1.5">
            <label htmlFor={`${formId}-start`} className="text-xs font-medium text-muted-foreground">
              Start time
            </label>
            <Select value={startTime} onValueChange={(value) => setStartTime(value as string)}>
              <SelectTrigger id={`${formId}-start`}>
                <SelectValue>{(value: string) => getTimeLabel(value)}</SelectValue>
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
          <div className="flex flex-col gap-1.5">
            <label htmlFor={`${formId}-end`} className="text-xs font-medium text-muted-foreground">
              End time
            </label>
            <Select value={endTime} onValueChange={(value) => setEndTime(value as string)}>
              <SelectTrigger id={`${formId}-end`}>
                <SelectValue>{(value: string) => getTimeLabel(value)}</SelectValue>
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
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}
      </form>

      <DialogFooter>
        <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>
          Cancel
        </Button>
        <Button type="submit" form={formId}>
          Save
        </Button>
      </DialogFooter>

      <div className="mt-4 border-t border-border pt-4">
        {confirmingDelete ? (
          <div className="flex items-center gap-2">
            <p className="flex-1 text-sm text-foreground">Delete this class?</p>
            <Button type="button" variant="secondary" size="sm" onClick={() => setConfirmingDelete(false)}>
              Keep class
            </Button>
            <Button
              type="button"
              variant="destructive"
              size="sm"
              onClick={() => onDelete(event.id)}
            >
              Confirm delete
            </Button>
          </div>
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
    </>
  )
}
