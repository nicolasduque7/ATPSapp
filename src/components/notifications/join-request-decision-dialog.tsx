"use client"

import { useEffect, useState } from "react"
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
import { getJoinRequestDetail, decideJoinRequest } from "@/lib/actions/join-requests"
import type { JoinRequestDetail } from "@/lib/queries/notifications"

interface JoinRequestDecisionDialogProps {
  requestId: string | null
  onOpenChange: (open: boolean) => void
  onDecided: (requestId: string) => void
}

export function JoinRequestDecisionDialog({
  requestId,
  onOpenChange,
  onDecided,
}: JoinRequestDecisionDialogProps) {
  const t = useTranslations("notifications")
  return (
    <Dialog open={!!requestId} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("joinRequestDialogTitle")}</DialogTitle>
        </DialogHeader>
        {requestId && (
          <JoinRequestDecisionView
            key={requestId}
            requestId={requestId}
            onOpenChange={onOpenChange}
            onDecided={onDecided}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}

function JoinRequestDecisionView({
  requestId,
  onOpenChange,
  onDecided,
}: {
  requestId: string
  onOpenChange: (open: boolean) => void
  onDecided: (requestId: string) => void
}) {
  const t = useTranslations("notifications")
  const dateFnsLocale = getDateFnsLocale(useLocale())
  const [detail, setDetail] = useState<JoinRequestDetail | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [decideError, setDecideError] = useState<string | null>(null)
  const [deciding, setDeciding] = useState(false)

  useEffect(() => {
    let cancelled = false
    getJoinRequestDetail(requestId)
      .then((data) => {
        if (!cancelled) setDetail(data)
      })
      .catch((err) => {
        if (!cancelled) setLoadError(err instanceof Error ? err.message : t("errorLoadRequest"))
      })
    return () => {
      cancelled = true
    }
  }, [requestId, t])

  async function handleDecide(approve: boolean) {
    setDecideError(null)
    setDeciding(true)
    const result = await decideJoinRequest(requestId, approve)
    if (!result.ok) {
      setDecideError(result.error)
      setDeciding(false)
      return
    }
    onDecided(requestId)
    onOpenChange(false)
  }

  if (loadError) {
    return <p className="mt-4 text-sm text-destructive">{loadError}</p>
  }

  if (!detail) {
    return <p className="mt-4 text-sm text-muted-foreground">{t("loading")}</p>
  }

  return (
    <div className="mt-4 flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <span className="text-xs font-medium text-muted-foreground">{t("requestedByLabel")}</span>
        <div className="flex h-9 items-center gap-2 rounded-xl border border-input bg-muted px-3 text-sm text-foreground">
          {detail.requestingStudentName}
          <LevelBadge level={detail.requestingStudentLevel} />
        </div>
      </div>
      <div className="flex flex-col gap-1.5">
        <span className="text-xs font-medium text-muted-foreground">{t("class")}</span>
        <div className="flex h-9 items-center gap-2 rounded-xl border border-input bg-muted px-3 text-sm text-foreground">
          {detail.hostStudentName}
          <LevelBadge level={detail.hostStudentLevel} />
        </div>
      </div>
      <ReadOnlyField label={t("court")} value={detail.locationName} />
      <div className="grid grid-cols-2 gap-4">
        <ReadOnlyField label={t("start")} value={formatClubDate(detail.startTime, "MMM d, h:mm a", dateFnsLocale)} />
        <ReadOnlyField label={t("end")} value={formatClubDate(detail.endTime, "h:mm a")} />
      </div>

      <p className="text-sm text-foreground">{t("authorizeQuestion")}</p>

      {decideError && <p className="text-sm text-destructive">{decideError}</p>}

      <DialogFooter>
        <Button
          type="button"
          variant="destructive"
          onClick={() => handleDecide(false)}
          disabled={deciding}
        >
          {t("no")}
        </Button>
        <Button type="button" onClick={() => handleDecide(true)} disabled={deciding}>
          {deciding ? t("saving") : t("yes")}
        </Button>
      </DialogFooter>
    </div>
  )
}
