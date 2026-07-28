"use client"

import { useEffect, useState } from "react"
import { formatClubDate } from "@/lib/dates"

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { ReadOnlyField } from "@/components/calendar/recurrence-fields"
import { StatusIcon } from "@/components/notifications/status-icon"
import { StudentPartnerCard } from "@/components/notifications/student-partner-card"
import { getSentJoinRequestDetail } from "@/lib/actions/join-requests"
import type { SentJoinRequestDetail } from "@/lib/actions/join-requests"

interface SentRequestDetailDialogProps {
  requestId: string | null
  onOpenChange: (open: boolean) => void
}

export function SentRequestDetailDialog({ requestId, onOpenChange }: SentRequestDetailDialogProps) {
  return (
    <Dialog open={!!requestId} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Join request</DialogTitle>
        </DialogHeader>
        {requestId && <SentRequestDetailView key={requestId} requestId={requestId} />}
      </DialogContent>
    </Dialog>
  )
}

function SentRequestDetailView({ requestId }: { requestId: string }) {
  const [detail, setDetail] = useState<SentJoinRequestDetail | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    getSentJoinRequestDetail(requestId)
      .then((data) => {
        if (!cancelled) setDetail(data)
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Couldn't load this request.")
      })
    return () => {
      cancelled = true
    }
  }, [requestId])

  if (error) return <p className="mt-4 text-sm text-destructive">{error}</p>
  if (!detail) return <p className="mt-4 text-sm text-muted-foreground">Loading…</p>

  return (
    <div className="mt-4 flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-muted-foreground">Status</span>
        <StatusIcon status={detail.status} />
      </div>
      <ReadOnlyField label="Court" value={detail.locationName} />
      <div className="grid grid-cols-2 gap-4">
        <ReadOnlyField label="Start" value={formatClubDate(detail.startTime, "MMM d, h:mm a")} />
        <ReadOnlyField label="End" value={formatClubDate(detail.endTime, "h:mm a")} />
      </div>

      <span className="text-xs font-medium text-muted-foreground">Host</span>
      <StudentPartnerCard student={detail.host} />
    </div>
  )
}
