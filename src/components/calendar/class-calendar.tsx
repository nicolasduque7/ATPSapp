"use client"

import { useMemo, useState } from "react"
import { Calendar, type EventProps, type View } from "react-big-calendar"
import { Plus } from "lucide-react"
import { useLocale, useTranslations } from "next-intl"

import "react-big-calendar/lib/css/react-big-calendar.css"
import "@/components/calendar/calendar-overrides.css"

import { Button } from "@/components/ui/button"
import { useHasMounted } from "@/lib/hooks/use-has-mounted"
import { CalendarToolbar } from "@/components/calendar/calendar-toolbar"
import { CalendarEventTile, CalendarEventTileCompact } from "@/components/calendar/calendar-event"
import { CoachFilterPopover } from "@/components/calendar/coach-filter-popover"
import { CALENDAR_VIEWS, MAX_TIME, MIN_TIME, localizer } from "@/components/calendar/calendar-config"
import { ClassEditDialog, createDraftEvent } from "@/components/calendar/class-edit-dialog"
import { AvailabilityEditDialog } from "@/components/calendar/availability-edit-dialog"
import { NotifyDialog } from "@/components/notify-dialog"
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
  const t = useTranslations("calendar")
  const locale = useLocale()
  const hasMounted = useHasMounted()
  const [view, setView] = useState<CalendarViewKey>("week")
  const [date, setDate] = useState(() => new Date())
  const [classEvents, setClassEvents] = useState(initialClassEvents)
  const [availabilityEvents, setAvailabilityEvents] = useState(initialAvailabilityEvents)
  const [selectedEvent, setSelectedEvent] = useState<CalendarClassEvent | null>(null)
  const [creatingEvent, setCreatingEvent] = useState<CalendarClassEvent | null>(null)
  const [editingAvailability, setEditingAvailability] = useState<AvailabilityDialogTarget | null>(null)
  const [visibleClassCoachIds, setVisibleClassCoachIds] = useState<Set<string>>(new Set())
  const [visibleAvailabilityCoachIds, setVisibleAvailabilityCoachIds] = useState<Set<string>>(new Set())
  const [notifyOpen, setNotifyOpen] = useState(false)

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
        const result = await createClass(submission.input)
        if (!result.ok) throw new Error(result.error)
        const mapped = mapClassInstanceToEvent(result.data, students, locations, coaches)
        if (mapped) setClassEvents((prev) => [...prev, { kind: "class" as const, ...mapped }])
        return
      }
      case "series-create": {
        const result = await createClassSeries(submission.input)
        if (!result.ok) throw new Error(result.error)
        const mapped = result.data.flatMap((instance) => {
          const event = mapClassInstanceToEvent(instance, students, locations, coaches)
          return event ? [{ kind: "class" as const, ...event }] : []
        })
        setClassEvents((prev) => [...prev, ...mapped])
        return
      }
      case "instance-edit": {
        if (!selectedEvent) return
        const result = await updateClassInstance(selectedEvent.id, submission.input)
        if (!result.ok) throw new Error(result.error)
        const mapped = mapClassInstanceToEvent(result.data, students, locations, coaches)
        if (mapped) {
          setClassEvents((prev) => prev.map((e) => (e.id === mapped.id ? { kind: "class" as const, ...mapped } : e)))
        }
        setNotifyOpen(true)
        return
      }
      case "series-edit": {
        const result = await updateClassSeries(submission.seriesId, submission.input)
        if (!result.ok) throw new Error(result.error)
        const mapped = result.data.flatMap((instance) => {
          const event = mapClassInstanceToEvent(instance, students, locations, coaches)
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
      const result = await deleteClassSeries(seriesId)
      if (!result.ok) throw new Error(result.error)
      setClassEvents((prev) => prev.filter((e) => e.resource.seriesId !== seriesId))
    } else {
      const result = await deleteClassInstance(eventId)
      if (!result.ok) throw new Error(result.error)
      setClassEvents((prev) => prev.filter((e) => e.id !== eventId))
    }
    setSelectedEvent(null)
    setNotifyOpen(true)
  }

  async function handleSaveAvailability(submission: AvailabilityFormSubmission) {
    switch (submission.kind) {
      case "one-off-create": {
        const result = await createAvailabilityBlock(submission.input)
        if (!result.ok) throw new Error(result.error)
        setAvailabilityEvents((prev) => [
          ...prev,
          { kind: "availability" as const, ...mapAvailabilityBlockToEvent(result.data, coaches, locations) },
        ])
        return
      }
      case "series-create": {
        const result = await createAvailabilitySeries(submission.input)
        if (!result.ok) throw new Error(result.error)
        const mapped = result.data.blocks.map((block) => ({
          kind: "availability" as const,
          ...mapAvailabilityBlockToEvent(block, coaches, locations),
        }))
        setAvailabilityEvents((prev) => [...prev, ...mapped])
        return
      }
      case "one-off-edit": {
        if (editingAvailability?.kind !== "block") return
        const result = await updateAvailabilityBlock(editingAvailability.block.id, submission.input)
        if (!result.ok) throw new Error(result.error)
        const mapped = mapAvailabilityBlockToEvent(result.data, coaches, locations)
        setAvailabilityEvents((prev) =>
          prev.map((e) => (e.id === mapped.id ? { kind: "availability" as const, ...mapped } : e))
        )
        return
      }
      case "series-edit": {
        const result = await updateAvailabilitySeries(submission.seriesId, submission.input)
        if (!result.ok) throw new Error(result.error)
        const mapped = result.data.map((block) => ({
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
      const result = await deleteAvailabilitySeries(target.id)
      if (!result.ok) throw new Error(result.error)
      setAvailabilityEvents((prev) => prev.filter((e) => e.resource.seriesId !== target.id))
    } else {
      const result = await deleteAvailabilityBlock(target.id)
      if (!result.ok) throw new Error(result.error)
      setAvailabilityEvents((prev) => prev.filter((e) => e.id !== target.id))
    }
    setEditingAvailability(null)
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-2xl font-bold text-foreground">{t("title")}</h1>
          <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
        </div>
        <Button
          type="button"
          variant="positive"
          size="icon"
          aria-label={t("addClass")}
          onClick={handleAddClick}
          disabled={students.length === 0 || locations.length === 0}
        >
          <Plus />
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-2 rounded-2xl bg-card p-3">
        <span className="text-xs font-medium text-muted-foreground">{t("showOnCalendar")}</span>
        <CoachFilterPopover
          label={t("otherCoachesClasses")}
          coaches={otherCoaches}
          allCoaches={coaches}
          selectedIds={visibleClassCoachIds}
          onToggle={toggleClassCoach}
          emptyLabel={t("noOtherCoaches")}
        />
        <CoachFilterPopover
          label={t("coachesWorkingHours")}
          coaches={coaches}
          allCoaches={coaches}
          selectedIds={visibleAvailabilityCoachIds}
          onToggle={toggleAvailabilityCoach}
          emptyLabel={t("noCoaches")}
        />
      </div>

      {displayedEvents.length === 0 ? (
        <div className="rounded-3xl bg-card p-6 text-sm text-muted-foreground">{t("noClassesScheduled")}</div>
      ) : (
        <div
          className="courtside-calendar h-[1150px] rounded-3xl bg-card p-4 sm:p-6"
          data-calendar-view={view}
        >
          {hasMounted ? (
            <Calendar<CalendarEvent>
              localizer={localizer}
              culture={locale === "es" ? "es" : "en-US"}
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
          ) : (
            <div className="h-full animate-pulse rounded-2xl bg-muted motion-reduce:animate-none" />
          )}
        </div>
      )}

      <ClassEditDialog
        event={selectedEvent}
        mode="edit"
        currentCoachId={currentCoachId}
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
        currentCoachId={currentCoachId}
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

      <NotifyDialog open={notifyOpen} onOpenChange={setNotifyOpen} />
    </div>
  )
}
