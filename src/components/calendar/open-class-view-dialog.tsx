"use client"

import { useState } from "react"
import { useLocale, useTranslations } from "next-intl"
import { formatClubDate } from "@/lib/dates"
import { getDateFnsLocale } from "@/lib/date-locale"

import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { LevelBadge } from "@/components/level-badge"
import { ReadOnlyField } from "@/components/calendar/recurrence-fields"
import { requestToJoinClass } from "@/lib/actions/join-requests"
import type { CalendarClassEvent } from "@/components/calendar/types"

interface OpenClassViewDialogProps {
  event: CalendarClassEvent | null
  onOpenChange: (open: boolean) => void
  onRequested?: () => void
}

export function OpenClassViewDialog({ event, onOpenChange, onRequested }: OpenClassViewDialogProps) {
  const t = useTranslations("openClass")
  return (
    <Dialog open={!!event} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("title")}</DialogTitle>
        </DialogHeader>
        {event && (
          <OpenClassView event={event} onOpenChange={onOpenChange} onRequested={onRequested} />
        )}
      </DialogContent>
    </Dialog>
  )
}

function OpenClassView({
  event,
  onOpenChange,
  onRequested,
}: {
  event: CalendarClassEvent
  onOpenChange: (open: boolean) => void
  onRequested?: () => void
}) {
  const t = useTranslations("openClass")
  const dateFnsLocale = getDateFnsLocale(useLocale())
  const [requesting, setRequesting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [requested, setRequested] = useState(false)
  const { studentName, level, coachName, locationName } = event.resource

  async function handleRequest() {
    setError(null)
    setRequesting(true)
    const result = await requestToJoinClass(event.id)
    setRequesting(false)
    if (!result.ok) {
      setError(result.error)
      return
    }
    setRequested(true)
    onRequested?.()
  }

  return (
    <>
      <div className="mt-4 flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-muted-foreground">{t("student")}</span>
          <div className="flex h-9 items-center gap-2 rounded-xl border border-input bg-muted px-3 text-sm text-foreground">
            {studentName}
            <LevelBadge level={level} />
          </div>
        </div>
        <ReadOnlyField label={t("coach")} value={coachName} />
        <ReadOnlyField label={t("court")} value={locationName} />
        <div className="grid grid-cols-2 gap-4">
          <ReadOnlyField label={t("start")} value={formatClubDate(event.start, "MMM d, h:mm a", dateFnsLocale)} />
          <ReadOnlyField label={t("end")} value={formatClubDate(event.end, "MMM d, h:mm a", dateFnsLocale)} />
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}
        {requested && <p className="text-sm text-positive">{t("requestSent")}</p>}
      </div>

      <DialogFooter>
        <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>
          {requested ? t("close") : t("cancel")}
        </Button>
        {!requested && (
          <Button type="button" onClick={handleRequest} disabled={requesting}>
            {requesting ? t("requesting") : t("requestToJoin")}
          </Button>
        )}
      </DialogFooter>
    </>
  )
}
