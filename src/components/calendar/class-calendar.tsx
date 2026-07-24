"use client"

import { useMemo, useState } from "react"
import { format, getDay, parse, startOfWeek } from "date-fns"
import { enUS } from "date-fns/locale"
import { Calendar, dateFnsLocalizer, type EventProps, type View } from "react-big-calendar"
import { Plus } from "lucide-react"

import "react-big-calendar/lib/css/react-big-calendar.css"
import "@/components/calendar/calendar-overrides.css"

import { Button } from "@/components/ui/button"
import { CalendarToolbar } from "@/components/calendar/calendar-toolbar"
import { CalendarEventTile, CalendarEventTileCompact } from "@/components/calendar/calendar-event"
import { CoachFilterPopover } from "@/components/calendar/coach-filter-popover"
import { ThreeDayView } from "@/components/calendar/three-day-view"
import { ClassEditDialog, createDraftEvent } from "@/components/calendar/class-edit-dialog"
import { AvailabilityEditDialog } from "@/components/calendar/availability-edit-dialog"
import { mapClassInstanceToEvent } from "@/components/calendar/map-class-instance"
import { mapAvailabilityBlockToEvent } from "@/components/calendar/map-availability-block"
import { getCoachAccentVar } from "@/lib/coach-colors"
import {
  createClass,
  createClassSeries,
  deleteClassInstance,
  deleteClassSeries,
  updateClassInstance,
  updateClassSeries,
} from "@/lib/actions/classes"
import {
  createAvailabilityBlock,
  createAvailabilitySeries,
  deleteAvailabilityBlock,
  deleteAvailabilitySeries,
  updateAvailabilityBlock,
  updateAvailabilitySeries,
} from "@/lib/actions/availability"
import type {
  AvailabilityDialogTarget,
  AvailabilityFormSubmission,
  CalendarClassEvent,
  CalendarEvent,
  CalendarViewKey,
  ClassFormSubmission,
} from "@/components/calendar/types"
import type { AvailabilityBlock, Coach, Location, Student } from "@/lib/mock-data"

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
  classEvents: CalendarEvent[]
  availabilityEvents: CalendarEvent[]
  students: Student[]
  locations: Location[]
  coaches: Coach[]
  currentCoachId: string
}

export function ClassCalendar({
  classEvents: initialClassEvents,
  availabilityEvents: initialAvailabilityEvents,
  students,
  locations,
  coaches,
  currentCoachId,
}: ClassCalendarProps) {
  const [view, setView] = useState<CalendarViewKey>("week")
  const [date, setDate] = useState(() => new Date())
  const [classEvents, setClassEvents] = useState(initialClassEvents)
  const [availabilityEvents, setAvailabilityEvents] = useState(initialAvailabilityEvents)
  const [selectedEvent, setSelectedEvent] = useState<CalendarClassEvent | null>(null)
  const [creatingEvent, setCreatingEvent] = useState<CalendarClassEvent | null>(null)
  const [editingAvailability, setEditingAvailability] = useState<AvailabilityDialogTarget | null>(null)
  const [visibleClassCoachIds, setVisibleClassCoachIds] = useState<Set<string>>(new Set())
  const [visibleAvailabilityCoachIds, setVisibleAvailabilityCoachIds] = useState<Set<string>>(new Set())

  const otherCoaches = useMemo(
    () => coaches.filter((coach) => coach.id !== currentCoachId),
    [coaches, currentCoachId]
  )

  const displayedEvents = useMemo(() => {
    const filteredClasses = classEvents.filter(
      (event) => event.resource.coachId === currentCoachId || visibleClassCoachIds.has(event.resource.coachId)
    )
    const filteredAvailability = availabilityEvents.filter((event) =>
      visibleAvailabilityCoachIds.has(event.resource.coachId)
    )
    return [...filteredClasses, ...filteredAvailability]
  }, [classEvents, availabilityEvents, currentCoachId, visibleClassCoachIds, visibleAvailabilityCoachIds])

  const components = useMemo(
    () => ({
      toolbar: CalendarToolbar,
      event: (props: EventProps<CalendarEvent>) => (
        <CalendarEventTile event={props.event} currentCoachId={currentCoachId} />
      ),
      month: {
        event: (props: EventProps<CalendarEvent>) => (
          <CalendarEventTileCompact event={props.event} currentCoachId={currentCoachId} />
        ),
      },
    }),
    [currentCoachId]
  )

  function eventPropGetter(event: CalendarEvent) {
    if (event.kind === "availability") {
      return {
        className: "courtside-availability-event",
        style: { "--event-accent": `var(${getCoachAccentVar(event.resource.coachId, coaches)})` } as React.CSSProperties,
      }
    }
    if (event.resource.coachId !== currentCoachId) {
      return {
        className: "courtside-other-coach-event",
        style: { "--event-accent": `var(${getCoachAccentVar(event.resource.coachId, coaches)})` } as React.CSSProperties,
      }
    }
    return {}
  }

  function toggleClassCoach(coachId: string) {
    setVisibleClassCoachIds((prev) => {
      const next = new Set(prev)
      if (next.has(coachId)) next.delete(coachId)
      else next.add(coachId)
      return next
    })
  }

  function toggleAvailabilityCoach(coachId: string) {
    setVisibleAvailabilityCoachIds((prev) => {
      const next = new Set(prev)
      if (next.has(coachId)) next.delete(coachId)
      else next.add(coachId)
      return next
    })
  }

  function handleAddClick() {
    setCreatingEvent(createDraftEvent())
  }

  function handleSelectEvent(event: CalendarEvent) {
    if (event.resource.coachId !== currentCoachId) return
    if (event.kind === "class") {
      setSelectedEvent(event)
      return
    }
    const block: AvailabilityBlock = {
      id: event.id,
      coachId: event.resource.coachId,
      seriesId: event.resource.seriesId ?? null,
      locationIds: event.resource.locationIds,
      startTime: event.start,
      endTime: event.end,
    }
    setEditingAvailability({ kind: "block", block })
  }

  async function handleSave(submission: ClassFormSubmission) {
    switch (submission.kind) {
      case "one-off": {
        const created = await createClass(submission.input)
        const mapped = mapClassInstanceToEvent(created, students, locations, coaches)
        if (mapped) setClassEvents((prev) => [...prev, { kind: "class" as const, ...mapped }])
        return
      }
      case "series-create": {
        const created = await createClassSeries(submission.input)
        const mapped = created.flatMap((instance) => {
          const event = mapClassInstanceToEvent(instance, students, locations, coaches)
          return event ? [{ kind: "class" as const, ...event }] : []
        })
        setClassEvents((prev) => [...prev, ...mapped])
        return
      }
      case "instance-edit": {
        if (!selectedEvent) return
        const updated = await updateClassInstance(selectedEvent.id, submission.input)
        const mapped = mapClassInstanceToEvent(updated, students, locations, coaches)
        if (mapped) {
          setClassEvents((prev) => prev.map((e) => (e.id === mapped.id ? { kind: "class" as const, ...mapped } : e)))
        }
        return
      }
      case "series-edit": {
        const updated = await updateClassSeries(submission.seriesId, submission.input)
        const mapped = updated.flatMap((instance) => {
          const event = mapClassInstanceToEvent(instance, students, locations, coaches)
          return event ? [{ kind: "class" as const, ...event }] : []
        })
        setClassEvents((prev) => [
          ...prev.filter((e) => e.resource.seriesId !== submission.seriesId),
          ...mapped,
        ])
        return
      }
    }
  }

  async function handleDelete(eventId: string, options?: { deleteSeries?: boolean }) {
    const target = classEvents.find((e) => e.id === eventId)
    if (options?.deleteSeries && target?.resource.seriesId) {
      const seriesId = target.resource.seriesId
      await deleteClassSeries(seriesId)
      setClassEvents((prev) => prev.filter((e) => e.resource.seriesId !== seriesId))
    } else {
      await deleteClassInstance(eventId)
      setClassEvents((prev) => prev.filter((e) => e.id !== eventId))
    }
    setSelectedEvent(null)
  }

  async function handleSaveAvailability(submission: AvailabilityFormSubmission) {
    switch (submission.kind) {
      case "one-off-create": {
        const created = await createAvailabilityBlock(submission.input)
        setAvailabilityEvents((prev) => [
          ...prev,
          { kind: "availability" as const, ...mapAvailabilityBlockToEvent(created, coaches, locations) },
        ])
        return
      }
      case "series-create": {
        const { blocks } = await createAvailabilitySeries(submission.input)
        const mapped = blocks.map((block) => ({
          kind: "availability" as const,
          ...mapAvailabilityBlockToEvent(block, coaches, locations),
        }))
        setAvailabilityEvents((prev) => [...prev, ...mapped])
        return
      }
      case "one-off-edit": {
        if (editingAvailability?.kind !== "block") return
        const updated = await updateAvailabilityBlock(editingAvailability.block.id, submission.input)
        const mapped = mapAvailabilityBlockToEvent(updated, coaches, locations)
        setAvailabilityEvents((prev) =>
          prev.map((e) => (e.id === mapped.id ? { kind: "availability" as const, ...mapped } : e))
        )
        return
      }
      case "series-edit": {
        const updated = await updateAvailabilitySeries(submission.seriesId, submission.input)
        const mapped = updated.map((block) => ({
          kind: "availability" as const,
          ...mapAvailabilityBlockToEvent(block, coaches, locations),
        }))
        setAvailabilityEvents((prev) => [
          ...prev.filter((e) => e.resource.seriesId !== submission.seriesId),
          ...mapped,
        ])
        return
      }
    }
  }

  async function handleDeleteAvailability(target: { kind: "block" | "series"; id: string }) {
    if (target.kind === "series") {
      await deleteAvailabilitySeries(target.id)
      setAvailabilityEvents((prev) => prev.filter((e) => e.resource.seriesId !== target.id))
    } else {
      await deleteAvailabilityBlock(target.id)
      setAvailabilityEvents((prev) => prev.filter((e) => e.id !== target.id))
    }
    setEditingAvailability(null)
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

      <div className="flex flex-wrap items-center gap-2 rounded-2xl bg-card p-3">
        <span className="text-xs font-medium text-muted-foreground">Show on calendar:</span>
        <CoachFilterPopover
          label="Classes booked"
          coaches={otherCoaches}
          allCoaches={coaches}
          selectedIds={visibleClassCoachIds}
          onToggle={toggleClassCoach}
          emptyLabel="No other coaches yet."
        />
        <CoachFilterPopover
          label="Working hours"
          coaches={coaches}
          allCoaches={coaches}
          selectedIds={visibleAvailabilityCoachIds}
          onToggle={toggleAvailabilityCoach}
          emptyLabel="No coaches yet."
        />
      </div>

      {displayedEvents.length === 0 ? (
        <div className="rounded-3xl bg-card p-6 text-sm text-muted-foreground">
          No classes scheduled yet.
        </div>
      ) : (
        <div
          className="courtside-calendar h-[1150px] rounded-3xl bg-card p-4 sm:p-6"
          data-calendar-view={view}
        >
          <Calendar<CalendarEvent>
            localizer={localizer}
            events={displayedEvents}
            view={view as View}
            onView={(nextView) => setView(nextView as unknown as CalendarViewKey)}
            date={date}
            onNavigate={setDate}
            onSelectEvent={handleSelectEvent}
            eventPropGetter={eventPropGetter}
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

      <AvailabilityEditDialog
        target={editingAvailability}
        locations={locations}
        onOpenChange={(open) => {
          if (!open) setEditingAvailability(null)
        }}
        onSave={handleSaveAvailability}
        onDelete={handleDeleteAvailability}
      />
    </div>
  )
}
