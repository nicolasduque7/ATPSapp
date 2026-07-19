"use client"

import { useMemo, useState } from "react"
import { format, getDay, parse, startOfWeek } from "date-fns"
import { enUS } from "date-fns/locale"
import { Calendar, dateFnsLocalizer, type View } from "react-big-calendar"

import "react-big-calendar/lib/css/react-big-calendar.css"
import "@/components/calendar/calendar-overrides.css"

import { CalendarToolbar } from "@/components/calendar/calendar-toolbar"
import { ClassEventTile, ClassEventTileCompact } from "@/components/calendar/calendar-event"
import { ThreeDayView } from "@/components/calendar/three-day-view"
import { ClassEditDialog } from "@/components/calendar/class-edit-dialog"
import type { CalendarClassEvent, CalendarViewKey } from "@/components/calendar/types"
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

  const components = useMemo(
    () => ({
      toolbar: CalendarToolbar,
      event: ClassEventTile,
      month: { event: ClassEventTileCompact },
    }),
    []
  )

  function handleSave(updated: CalendarClassEvent) {
    setEvents((prev) => prev.map((e) => (e.id === updated.id ? updated : e)))
  }

  function handleDelete(eventId: string) {
    setEvents((prev) => prev.filter((e) => e.id !== eventId))
    setSelectedEvent(null)
  }

  return (
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

      <ClassEditDialog
        event={selectedEvent}
        students={students}
        locations={locations}
        onOpenChange={(open) => {
          if (!open) setSelectedEvent(null)
        }}
        onSave={handleSave}
        onDelete={handleDelete}
      />
    </div>
  )
}
