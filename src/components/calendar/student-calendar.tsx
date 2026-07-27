"use client"

import { useMemo, useState } from "react"
import { Calendar, type EventProps, type View } from "react-big-calendar"
import { Plus } from "lucide-react"

import "react-big-calendar/lib/css/react-big-calendar.css"
import "@/components/calendar/calendar-overrides.css"

import { Button } from "@/components/ui/button"
import { CalendarToolbar } from "@/components/calendar/calendar-toolbar"
import { CalendarEventTile, CalendarEventTileCompact } from "@/components/calendar/calendar-event"
import { CoachFilterPopover } from "@/components/calendar/coach-filter-popover"
import { CALENDAR_VIEWS, MAX_TIME, MIN_TIME, localizer } from "@/components/calendar/calendar-config"
import { StudentClassEditDialog } from "@/components/calendar/student-class-edit-dialog"
import { createDraftEvent } from "@/components/calendar/class-edit-dialog"
import { OpenClassViewDialog } from "@/components/calendar/open-class-view-dialog"
import { NotifyDialog } from "@/components/notify-dialog"
import { mapClassInstanceToEvent } from "@/components/calendar/map-class-instance"
import { getCoachAccentVar } from "@/lib/coach-colors"
import { cn } from "@/lib/utils"
import {
  createStudentClass,
  createStudentClassSeries,
  deleteStudentClassInstance,
  deleteStudentClassSeries,
  updateStudentClassInstance,
  updateStudentClassSeries,
} from "@/lib/actions/student-classes"
import type {
  CalendarClassEvent,
  CalendarEvent,
  CalendarViewKey,
  StudentClassFormSubmission,
} from "@/components/calendar/types"
import type { Coach, Location, Student } from "@/lib/mock-data"

interface StudentCalendarProps {
  classEvents: CalendarEvent[]
  availabilityEvents: CalendarEvent[]
  openClassEvents: CalendarEvent[]
  coaches: Coach[]
  locations: Location[]
  studentProfile: Student
}

export function StudentCalendar({
  classEvents: initialClassEvents,
  availabilityEvents: initialAvailabilityEvents,
  openClassEvents,
  coaches,
  locations,
  studentProfile,
}: StudentCalendarProps) {
  const [view, setView] = useState<CalendarViewKey>("week")
  const [date, setDate] = useState(() => new Date())
  const [classEvents, setClassEvents] = useState(initialClassEvents)
  const [availabilityEvents] = useState(initialAvailabilityEvents)
  const [selectedEvent, setSelectedEvent] = useState<CalendarClassEvent | null>(null)
  const [creatingEvent, setCreatingEvent] = useState<CalendarClassEvent | null>(null)
  const [openClassViewEvent, setOpenClassViewEvent] = useState<CalendarClassEvent | null>(null)
  const [visibleAvailabilityCoachIds, setVisibleAvailabilityCoachIds] = useState<Set<string>>(new Set())
  const [showOpenClasses, setShowOpenClasses] = useState(false)
  const [notifyOpen, setNotifyOpen] = useState(false)

  // Every fetched class already IS the student's own (RLS guarantees it), so
  // unlike the coach calendar there's no "other students' bookings" toggle
  // for classEvents itself — classes always show. Working-hours blocks and
  // other students' Open Classes are each gated by their own toggle.
  const displayedEvents = useMemo(() => {
    const filteredAvailability = availabilityEvents.filter((event) =>
      visibleAvailabilityCoachIds.has(event.resource.coachId)
    )
    return [...classEvents, ...filteredAvailability, ...(showOpenClasses ? openClassEvents : [])]
  }, [classEvents, availabilityEvents, visibleAvailabilityCoachIds, showOpenClasses, openClassEvents])

  // A student's classes legitimately span multiple coaches, so the
  // coach-name badge should always render — passing an id that can never
  // match a real coach keeps CalendarEventTile's "isOwn" check permanently
  // false, which is exactly that behavior with no changes to that component.
  const components = useMemo(
    () => ({
      toolbar: CalendarToolbar,
      event: (props: EventProps<CalendarEvent>) => <CalendarEventTile event={props.event} currentCoachId="" />,
      month: {
        event: (props: EventProps<CalendarEvent>) => (
          <CalendarEventTileCompact event={props.event} currentCoachId="" />
        ),
      },
    }),
    []
  )

  function eventPropGetter(event: CalendarEvent) {
    if (event.kind === "availability") {
      return {
        className: "courtside-availability-event",
        style: { "--event-accent": `var(${getCoachAccentVar(event.resource.coachId, coaches)})` } as React.CSSProperties,
      }
    }
    if (event.resource.studentId !== studentProfile.id) {
      return { className: "courtside-open-class-event" }
    }
    return {}
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

  // Working-hours blocks are permanently read-only on the student calendar —
  // there's no valid "editable" case for them here, so this is
  // unconditional rather than the coach calendar's ownership check. A class
  // event that isn't the student's own can only be another student's Open
  // Class (that's the only thing openClassEvents ever contains), so it opens
  // the read-only view+request dialog instead of the edit dialog.
  function handleSelectEvent(event: CalendarEvent) {
    if (event.kind !== "class") return
    if (event.resource.studentId !== studentProfile.id) {
      setOpenClassViewEvent(event)
      return
    }
    setSelectedEvent(event)
  }

  async function handleSave(submission: StudentClassFormSubmission) {
    switch (submission.kind) {
      case "one-off": {
        const created = await createStudentClass(submission.input)
        const mapped = mapClassInstanceToEvent(created, [studentProfile], locations, coaches)
        if (mapped) setClassEvents((prev) => [...prev, { kind: "class" as const, ...mapped }])
        return
      }
      case "series-create": {
        const created = await createStudentClassSeries(submission.input)
        const mapped = created.flatMap((instance) => {
          const event = mapClassInstanceToEvent(instance, [studentProfile], locations, coaches)
          return event ? [{ kind: "class" as const, ...event }] : []
        })
        setClassEvents((prev) => [...prev, ...mapped])
        return
      }
      case "instance-edit": {
        if (!selectedEvent) return
        const updated = await updateStudentClassInstance(selectedEvent.id, submission.input)
        const mapped = mapClassInstanceToEvent(updated, [studentProfile], locations, coaches)
        if (mapped) {
          setClassEvents((prev) => prev.map((e) => (e.id === mapped.id ? { kind: "class" as const, ...mapped } : e)))
        }
        setNotifyOpen(true)
        return
      }
      case "series-edit": {
        const updated = await updateStudentClassSeries(submission.seriesId, submission.input)
        const mapped = updated.flatMap((instance) => {
          const event = mapClassInstanceToEvent(instance, [studentProfile], locations, coaches)
          return event ? [{ kind: "class" as const, ...event }] : []
        })
        setClassEvents((prev) => [
          ...prev.filter((e) => e.resource.seriesId !== submission.seriesId),
          ...mapped,
        ])
        setNotifyOpen(true)
        return
      }
    }
  }

  async function handleDelete(eventId: string, options?: { deleteSeries?: boolean }) {
    const target = classEvents.find((e) => e.id === eventId)
    if (options?.deleteSeries && target?.resource.seriesId) {
      const seriesId = target.resource.seriesId
      await deleteStudentClassSeries(seriesId)
      setClassEvents((prev) => prev.filter((e) => e.resource.seriesId !== seriesId))
    } else {
      await deleteStudentClassInstance(eventId)
      setClassEvents((prev) => prev.filter((e) => e.id !== eventId))
    }
    setSelectedEvent(null)
    setNotifyOpen(true)
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
          aria-label="Book a class"
          onClick={handleAddClick}
          disabled={coaches.length === 0 || locations.length === 0}
        >
          <Plus />
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-2 rounded-2xl bg-card p-3">
        <span className="text-xs font-medium text-muted-foreground">Show on calendar:</span>
        <CoachFilterPopover
          label="Coaches' working hours"
          coaches={coaches}
          allCoaches={coaches}
          selectedIds={visibleAvailabilityCoachIds}
          onToggle={toggleAvailabilityCoach}
          emptyLabel="No coaches yet."
        />
        <button
          type="button"
          aria-pressed={showOpenClasses}
          onClick={() => setShowOpenClasses((prev) => !prev)}
          className={cn(
            "inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-transparent px-3 py-1.5 text-xs font-medium transition-colors duration-200 outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card",
            showOpenClasses
              ? "bg-primary text-primary-foreground"
              : "bg-muted text-muted-foreground hover:bg-accent hover:text-foreground"
          )}
        >
          Other students&apos; Open Classes
        </button>
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

      <StudentClassEditDialog
        event={selectedEvent}
        mode="edit"
        coaches={coaches}
        locations={locations}
        onOpenChange={(open) => {
          if (!open) setSelectedEvent(null)
        }}
        onSave={handleSave}
        onDelete={handleDelete}
      />

      <StudentClassEditDialog
        event={creatingEvent}
        mode="create"
        coaches={coaches}
        locations={locations}
        onOpenChange={(open) => {
          if (!open) setCreatingEvent(null)
        }}
        onSave={handleSave}
      />

      <OpenClassViewDialog
        event={openClassViewEvent}
        onOpenChange={(open) => {
          if (!open) setOpenClassViewEvent(null)
        }}
      />

      <NotifyDialog open={notifyOpen} onOpenChange={setNotifyOpen} />
    </div>
  )
}
