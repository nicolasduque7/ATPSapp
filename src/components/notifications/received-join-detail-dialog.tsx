"use client"

import { useEffect, useState } from "react"
import { useLocale, useTranslations } from "next-intl"
import { formatClubDate } from "@/lib/dates"
import { getDateFnsLocale } from "@/lib/date-locale"

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { ReadOnlyField } from "@/components/calendar/recurrence-fields"
import { StudentPartnerCard } from "@/components/notifications/student-partner-card"
import { getReceivedJoinDetail } from "@/lib/actions/join-requests"
import type { ReceivedJoinDetail } from "@/lib/actions/join-requests"

interface ReceivedJoinDetailDialogProps {
  classId: string | null
  onOpenChange: (open: boolean) => void
}

export function ReceivedJoinDetailDialog({ classId, onOpenChange }: ReceivedJoinDetailDialogProps) {
  const t = useTranslations("notifications")
  return (
    <Dialog open={!!classId} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("classJoinedTitle")}</DialogTitle>
        </DialogHeader>
        {classId && <ReceivedJoinDetailView key={classId} classId={classId} />}
      </DialogContent>
    </Dialog>
  )
}

function ReceivedJoinDetailView({ classId }: { classId: string }) {
  const t = useTranslations("notifications")
  const dateFnsLocale = getDateFnsLocale(useLocale())
  const [detail, setDetail] = useState<ReceivedJoinDetail | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    getReceivedJoinDetail(classId)
      .then((data) => {
        if (!cancelled) setDetail(data)
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : t("errorLoadReceivedClass"))
      })
    return () => {
      cancelled = true
    }
  }, [classId, t])

  if (error) return <p className="mt-4 text-sm text-destructive">{error}</p>
  if (!detail) return <p className="mt-4 text-sm text-muted-foreground">{t("loading")}</p>

  return (
    <div className="mt-4 flex flex-col gap-4">
      <ReadOnlyField label={t("court")} value={detail.locationName} />
      <div className="grid grid-cols-2 gap-4">
        <ReadOnlyField label={t("start")} value={formatClubDate(detail.startTime, "MMM d, h:mm a", dateFnsLocale)} />
        <ReadOnlyField label={t("end")} value={formatClubDate(detail.endTime, "h:mm a")} />
      </div>

      <span className="text-xs font-medium text-muted-foreground">
        {detail.joiners.length === 1 ? t("joiningStudent") : t("joiningStudents")}
      </span>
      {detail.joiners.map((joiner) => (
        <StudentPartnerCard key={joiner.studentId} student={joiner} />
      ))}
    </div>
  )
}
