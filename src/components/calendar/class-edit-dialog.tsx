"use client"

import { useId, useState } from "react"

import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import type { Location, Student } from "@/lib/mock-data"
import type { CalendarClassEvent } from "@/components/calendar/types"

interface ClassEditDialogProps {
  event: CalendarClassEvent | null
  students: Student[]
  locations: Location[]
  onOpenChange: (open: boolean) => void
  onSave: (event: CalendarClassEvent) => void
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

const selectClassName =
  "w-full cursor-pointer rounded-xl border border-input bg-background px-3 py-2 text-sm text-foreground outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"

const timeInputClassName =
  "w-full rounded-xl border border-input bg-background px-3 py-2 text-sm text-foreground outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"

export function ClassEditDialog({
  event,
  students,
  locations,
  onOpenChange,
  onSave,
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
}

function ClassEditForm({ event, students, locations, onOpenChange, onSave }: ClassEditFormProps) {
  const formId = useId()
  const [studentId, setStudentId] = useState(event.resource.studentId)
  const [locationId, setLocationId] = useState(event.resource.locationId)
  const [startTime, setStartTime] = useState(() => toTimeInputValue(event.start))
  const [endTime, setEndTime] = useState(() => toTimeInputValue(event.end))
  const [error, setError] = useState<string | null>(null)

  function handleSubmit(formEvent: React.FormEvent) {
    formEvent.preventDefault()

    const student = students.find((s) => s.id === studentId)
    const location = locations.find((l) => l.id === locationId)
    if (!student || !location) return

    const start = applyTimeToDate(event.start, startTime)
    const end = applyTimeToDate(event.start, endTime)

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
          <select
            id={`${formId}-student`}
            className={selectClassName}
            value={studentId}
            onChange={(e) => setStudentId(e.target.value)}
          >
            {students.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} · {s.level}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor={`${formId}-location`} className="text-xs font-medium text-muted-foreground">
            Location
          </label>
          <select
            id={`${formId}-location`}
            className={selectClassName}
            value={locationId}
            onChange={(e) => setLocationId(e.target.value)}
          >
            {locations.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="flex flex-col gap-1.5">
            <label htmlFor={`${formId}-start`} className="text-xs font-medium text-muted-foreground">
              Start time
            </label>
            <input
              id={`${formId}-start`}
              type="time"
              className={timeInputClassName}
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor={`${formId}-end`} className="text-xs font-medium text-muted-foreground">
              End time
            </label>
            <input
              id={`${formId}-end`}
              type="time"
              className={timeInputClassName}
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
            />
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
    </>
  )
}
