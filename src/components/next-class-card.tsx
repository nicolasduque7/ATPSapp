"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { ArrowRight } from "lucide-react"
import { useLocale, useTranslations } from "next-intl"
import type { Locale } from "date-fns"

import { formatClubDate, formatClubTime, isSameClubDay } from "@/lib/dates"
import { getDateFnsLocale } from "@/lib/date-locale"
import { Avatar } from "@/components/avatar"
import { Button } from "@/components/ui/button"
import { NextClassCountdown } from "@/components/next-class-countdown"
import { NotifyDialog } from "@/components/notify-dialog"
import { ClassEditDialog } from "@/components/calendar/class-edit-dialog"
import { mapClassInstanceToEvent } from "@/components/calendar/map-class-instance"
import { deleteClassInstance, deleteClassSeries, updateClassInstance, updateClassSeries } from "@/lib/actions/classes"
import type { CalendarClassEvent, ClassFormSubmission } from "@/components/calendar/types"
import type { ClassInstance, Location, Student } from "@/lib/mock-data"

interface NextClassCardProps {
  nextClass: ClassInstance | undefined
  currentCoachId: string
  students: Student[]
  locations: Location[]
}

function formatTime(date: Date): string {
  return formatClubTime(date)
}

function formatDurationHours(durationMinutes: number): string {
  return `${durationMinutes / 60}h`
}

function formatDayLabel(date: Date, t: (key: "today" | "tomorrow") => string, dateFnsLocale: Locale): string {
  const now = new Date()
  const tomorrow = new Date(now.getTime() + 24 * 60 * 60_000)

  if (isSameClubDay(date, now)) return t("today")
  if (isSameClubDay(date, tomorrow)) return t("tomorrow")

  return formatClubDate(date, "EEE, MMM d", dateFnsLocale)
}

export function NextClassCard({ nextClass, currentCoachId, students, locations }: NextClassCardProps) {
  const t = useTranslations("dashboard")
  const appLocale = useLocale()
  const dateFnsLocale = getDateFnsLocale(appLocale)
  const router = useRouter()
  const [editingEvent, setEditingEvent] = useState<CalendarClassEvent | null>(null)
  const [notifyOpen, setNotifyOpen] = useState(false)

  const student = nextClass ? students.find((s) => s.id === nextClass.studentId) : undefined
  const location = nextClass ? locations.find((l) => l.id === nextClass.locationId) : undefined

  function handleOpenEdit() {
    if (!nextClass) return
    const event = mapClassInstanceToEvent(nextClass, students, locations)
    if (event) setEditingEvent(event)
  }

  async function handleSave(submission: ClassFormSubmission) {
    if (submission.kind === "instance-edit") {
      if (!editingEvent) return
      const result = await updateClassInstance(editingEvent.id, submission.input)
      if (!result.ok) throw new Error(result.error)
    } else if (submission.kind === "series-edit") {
      const result = await updateClassSeries(submission.seriesId, submission.input)
      if (!result.ok) throw new Error(result.error)
    }
    setNotifyOpen(true)
    router.refresh()
  }

  async function handleDelete(eventId: string, options?: { deleteSeries?: boolean }) {
    if (options?.deleteSeries && editingEvent?.resource.seriesId) {
      const result = await deleteClassSeries(editingEvent.resource.seriesId)
      if (!result.ok) throw new Error(result.error)
    } else {
      const result = await deleteClassInstance(eventId)
      if (!result.ok) throw new Error(result.error)
    }
    setEditingEvent(null)
    setNotifyOpen(true)
    router.refresh()
  }

  return (
    <div className="relative animate-in fade-in slide-in-from-bottom-2 fill-mode-both duration-300 motion-reduce:animate-none rounded-3xl bg-primary p-6 text-primary-foreground">
      <p className="text-sm text-primary-foreground/85">{t("nextClass")}</p>
      {nextClass ? (
        <>
          <span className="absolute top-6 right-6 inline-flex items-center rounded-full bg-primary-foreground/10 px-3 py-1 text-xs font-medium text-primary-foreground">
            <NextClassCountdown startTime={nextClass.startTime} />
          </span>

          <div className="mt-2 flex flex-wrap items-baseline gap-x-2 gap-y-1 pr-24">
            <p className="font-heading text-2xl font-bold">
              {formatDayLabel(nextClass.startTime, t, dateFnsLocale)} · {formatTime(nextClass.startTime)}
            </p>
            <p className="text-sm text-primary-foreground/85">
              – {formatTime(nextClass.endTime)} · {formatDurationHours(nextClass.durationMinutes)}
            </p>
          </div>

          {student && (
            <div className="mt-4 flex items-center gap-3">
              <Avatar name={student.name} className="bg-primary-foreground/10 text-primary-foreground" />
              <div className="flex flex-1 flex-col gap-1.5">
                <div className="flex items-center justify-between gap-3">
                  <span className="font-heading text-sm font-bold text-primary-foreground">
                    {student.name}
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    aria-label={t("editClassDetails")}
                    className="text-primary-foreground hover:bg-primary-foreground/15"
                    onClick={handleOpenEdit}
                  >
                    <ArrowRight />
                  </Button>
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                  {location && (
                    <span className="inline-flex w-fit items-center rounded-full bg-primary-foreground/10 px-2 py-0.5 text-[9px] font-medium text-primary-foreground">
                      {location.name}
                    </span>
                  )}
                  <span className="inline-flex w-fit items-center rounded-full bg-primary-foreground/10 px-2 py-0.5 text-[9px] font-medium text-primary-foreground">
                    {student.level}
                  </span>
                </div>
              </div>
            </div>
          )}
        </>
      ) : (
        <p className="mt-2 text-lg font-semibold">{t("nothingScheduled")}</p>
      )}

      <ClassEditDialog
        event={editingEvent}
        mode="edit"
        currentCoachId={currentCoachId}
        students={students}
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
