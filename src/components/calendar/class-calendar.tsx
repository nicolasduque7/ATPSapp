"use client"

import { useMemo, useState } from "react"
import { format, getDay, parse, startOfWeek } from "date-fns"
import { enUS } from "date-fns/locale"
import { Calendar, dateFnsLocalizer, type View } from "react-big-calendar"
import { Plus } from "lucide-react"

import "react-big-calendar/lib/css/react-big-calendar.css"
import "@/components/calendar/calendar-overrides.css"

import { Button } from "@/components/ui/button"
import { CalendarToolbar } from "@/components/calendar/calendar-toolbar"
import { ClassEventTile, ClassEventTileCompact } from "@/components/calendar/calendar-event"
import { ThreeDayView } from "@/components/calendar/three-day-view"
import { ClassEditDialog, createDraftEvent } from "@/components/calendar/class-edit-dialog"
import { mapClassInstanceToEvent } from "@/components/calendar/map-class-instance"
import {
  createClass,
  createClassSeries,
  deleteClassInstance,
  deleteClassSeries,
  updateClassInstance,
  updateClassSeries,
} from "@/lib/actions/classes"
import type { CalendarClassEvent, CalendarViewKey, ClassFormSubmission } from "@/components/calendar/types"
import type { Location, Student } from "@/lib/mock-data"

const locales = { "en-US": enUS }

const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek,
  getDay,
  locales,
})

const MIN_TIME = new Date(1970, 0, 1, 7, 0, 0)
const MAX_TIME = new Date(1970, 0, 1, 21, 0, 0)

// react-big-calendar's bundled types only model its 5 built-in views, but the
// library itself accepts any custom view object at runtime (this is the
// documented pattern for adding a view, e.g. a 3-day view, on top of its
// TimeGrid renderer) — cast through unknown to bridge that type gap.
const CALENDAR_VIEWS = {
  month: true,
  week: true,
  day: true,
  "three-day": ThreeDayView,
} as unknown as Record<string, boolean>

interface ClassCalendarProps {
  events: CalendarClassEvent[]
  students: Student[]
  locations: Location[]
}

export function ClassCalendar({ events: initialEvents, students, locations }: ClassCalendarProps) {
  const [view, setView] = useState<CalendarViewKey>("week")
  const [date, setDate] = useState(() => new Date())
  const [events, setEvents] = useState(initialEvents)
  const [selectedEvent, setSelectedEvent] = useState<CalendarClassEvent | null>(null)
  const [creatingEvent, setCreatingEvent] = useState<CalendarClassEvent | null>(null)

  const components = useMemo(
    () => ({
      toolbar: CalendarToolbar,
      event: ClassEventTile,
      month: { event: ClassEventTileCompact },
    }),
    []
  )

  function handleAddClick() {
    setCreatingEvent(createDraftEvent(students, locations))
  }

  async function handleSave(submission: ClassFormSubmission) {
    switch (submission.kind) {
      case "one-off": {
        const created = await createClass(submission.input)
        const mapped = mapClassInstanceToEvent(created, students, locations)
        if (mapped) setEvents((prev) => [...prev, mapped])
        return
      }
      case "series-create": {
        const created = await createClassSeries(submission.input)
        const mapped = created.flatMap((instance) => {
          const event = mapClassInstanceToEvent(instance, students, locations)
          return event ? [event] : []
        })
        setEvents((prev) => [...prev, ...mapped])
        return
      }
      case "instance-edit": {
        if (!selectedEvent) return
        const updated = await updateClassInstance(selectedEvent.id, submission.input)
        const mapped = mapClassInstanceToEvent(updated, students, locations)
        if (mapped) setEvents((prev) => prev.map((e) => (e.id === mapped.id ? mapped : e)))
        return
      }
      case "series-edit": {
        const updated = await updateClassSeries(submission.seriesId, submission.input)
        const mapped = updated.flatMap((instance) => {
          const event = mapClassInstanceToEvent(instance, students, locations)
          return event ? [event] : []
        })
        setEvents((prev) => [
          ...prev.filter((e) => e.resource.seriesId !== submission.seriesId),
          ...mapped,
        ])
        return
      }
    }
  }

  async function handleDelete(eventId: string, options?: { deleteSeries?: boolean }) {
    const target = events.find((e) => e.id === eventId)
    if (options?.deleteSeries && target?.resource.seriesId) {
      const seriesId = target.resource.seriesId
      await deleteClassSeries(seriesId)
      setEvents((prev) => prev.filter((e) => e.resource.seriesId !== seriesId))
    } else {
      await deleteClassInstance(eventId)
      setEvents((prev) => prev.filter((e) => e.id !== eventId))
    }
    setSelectedEvent(null)
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-2xl font-bold text-foreground">Calendar</h1>
          <p className="text-sm text-muted-foreground">
            Month, week, 3-day, and day views of your schedule.
          </p>
        </div>
        <Button
          type="button"
          variant="positive"
          size="icon"
          aria-label="Add class"
          onClick={handleAddClick}
          disabled={students.length === 0 || locations.length === 0}
        >
          <Plus />
        </Button>
      </div>

      {events.length === 0 ? (
        <div className="rounded-3xl bg-card p-6 text-sm text-muted-foreground">
          No classes scheduled yet.
        </div>
      ) : (
        <div
          className="courtside-calendar h-[1150px] rounded-3xl bg-card p-4 sm:p-6"
          data-calendar-view={view}
        >
          <Calendar<CalendarClassEvent>
            localizer={localizer}
            events={events}
            view={view as View}
            onView={(nextView) => setView(nextView as unknown as CalendarViewKey)}
            date={date}
            onNavigate={setDate}
            onSelectEvent={setSelectedEvent}
            views={CALENDAR_VIEWS}
            components={components}
            min={MIN_TIME}
            max={MAX_TIME}
            step={30}
            timeslots={2}
            dayLayoutAlgorithm="no-overlap"
            popup
            style={{ height: "100%" }}
          />
        </div>
      )}

      <ClassEditDialog
        event={selectedEvent}
        mode="edit"
        students={students}
        locations={locations}
        onOpenChange={(open) => {
          if (!open) setSelectedEvent(null)
        }}
        onSave={handleSave}
        onDelete={handleDelete}
      />

      <ClassEditDialog
        event={creatingEvent}
        mode="create"
        students={students}
        locations={locations}
        onOpenChange={(open) => {
          if (!open) setCreatingEvent(null)
        }}
        onSave={handleSave}
      />
    </div>
  )
}
