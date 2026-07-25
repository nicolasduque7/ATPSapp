"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { ArrowRight } from "lucide-react"

import { Avatar } from "@/components/avatar"
import { Button } from "@/components/ui/button"
import { NextClassCountdown } from "@/components/next-class-countdown"
import { NotifyDialog } from "@/components/notify-dialog"
import { StudentClassEditDialog } from "@/components/calendar/student-class-edit-dialog"
import { mapClassInstanceToEvent } from "@/components/calendar/map-class-instance"
import {
  deleteStudentClassInstance,
  deleteStudentClassSeries,
  updateStudentClassInstance,
  updateStudentClassSeries,
} from "@/lib/actions/student-classes"
import type { CalendarClassEvent, StudentClassFormSubmission } from "@/components/calendar/types"
import type { ClassInstance, Coach, Location, Student } from "@/lib/mock-data"

interface StudentNextClassCardProps {
  nextClass: ClassInstance | undefined
  studentProfile: Student
  coaches: Coach[]
  locations: Location[]
}

function formatTime(date: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
  }).format(date)
}

function formatDurationHours(durationMinutes: number): string {
  return `${durationMinutes / 60}h`
}

function formatDayLabel(date: Date): string {
  const now = new Date()
  const tomorrow = new Date(now)
  tomorrow.setDate(tomorrow.getDate() + 1)

  if (date.toDateString() === now.toDateString()) return "Today"
  if (date.toDateString() === tomorrow.toDateString()) return "Tomorrow"

  return new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  }).format(date)
}

export function StudentNextClassCard({
  nextClass,
  studentProfile,
  coaches,
  locations,
}: StudentNextClassCardProps) {
  const router = useRouter()
  const [editingEvent, setEditingEvent] = useState<CalendarClassEvent | null>(null)
  const [notifyOpen, setNotifyOpen] = useState(false)

  const coach = nextClass ? coaches.find((c) => c.id === nextClass.coachId) : undefined
  const location = nextClass ? locations.find((l) => l.id === nextClass.locationId) : undefined

  function handleOpenEdit() {
    if (!nextClass) return
    const event = mapClassInstanceToEvent(nextClass, [studentProfile], locations, coaches)
    if (event) setEditingEvent(event)
  }

  async function handleSave(submission: StudentClassFormSubmission) {
    if (submission.kind === "instance-edit") {
      if (!editingEvent) return
      await updateStudentClassInstance(editingEvent.id, submission.input)
    } else if (submission.kind === "series-edit") {
      await updateStudentClassSeries(submission.seriesId, submission.input)
    }
    setNotifyOpen(true)
    router.refresh()
  }

  async function handleDelete(eventId: string, options?: { deleteSeries?: boolean }) {
    if (options?.deleteSeries && editingEvent?.resource.seriesId) {
      await deleteStudentClassSeries(editingEvent.resource.seriesId)
    } else {
      await deleteStudentClassInstance(eventId)
    }
    setEditingEvent(null)
    setNotifyOpen(true)
    router.refresh()
  }

  return (
    <div className="relative animate-in fade-in slide-in-from-bottom-2 fill-mode-both duration-300 motion-reduce:animate-none rounded-3xl bg-primary p-6 text-primary-foreground">
      <p className="text-sm text-primary-foreground/70">Next class</p>
      {nextClass ? (
        <>
          <span className="absolute top-6 right-6 inline-flex items-center rounded-full bg-primary-foreground/15 px-3 py-1 text-xs font-medium text-primary-foreground">
            <NextClassCountdown startTime={nextClass.startTime} />
          </span>

          <div className="mt-2 flex flex-wrap items-baseline gap-x-2 gap-y-1 pr-24">
            <p className="font-heading text-2xl font-bold">
              {formatDayLabel(nextClass.startTime)} · {formatTime(nextClass.startTime)}
            </p>
            <p className="text-sm text-primary-foreground/70">
              – {formatTime(nextClass.endTime)} · {formatDurationHours(nextClass.durationMinutes)}
            </p>
          </div>

          {coach && (
            <div className="mt-4 flex items-center gap-3">
              <Avatar name={coach.name} className="bg-primary-foreground/15 text-primary-foreground" />
              <div className="flex flex-1 flex-col gap-1.5">
                <div className="flex items-center justify-between gap-3">
                  <span className="font-heading text-sm font-bold text-primary-foreground">
                    {coach.name}
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    aria-label="Edit class details"
                    className="text-primary-foreground hover:bg-primary-foreground/15"
                    onClick={handleOpenEdit}
                  >
                    <ArrowRight />
                  </Button>
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                  {location && (
                    <span className="inline-flex w-fit items-center rounded-full bg-primary-foreground/15 px-2 py-0.5 text-[9px] font-medium text-primary-foreground/90">
                      {location.name}
                    </span>
                  )}
                </div>
              </div>
            </div>
          )}
        </>
      ) : (
        <p className="mt-2 text-lg font-semibold">Nothing scheduled — enjoy the break.</p>
      )}

      <StudentClassEditDialog
        event={editingEvent}
        mode="edit"
        coaches={coaches}
        locations={locations}
        onOpenChange={(open) => {
          if (!open) setEditingEvent(null)
        }}
        onSave={handleSave}
        onDelete={handleDelete}
      />

      <NotifyDialog open={notifyOpen} onOpenChange={setNotifyOpen} />
    </div>
  )
}
