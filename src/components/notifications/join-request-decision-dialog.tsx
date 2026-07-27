"use client"

import { useEffect, useState } from "react"
import { format } from "date-fns"

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
  return (
    <Dialog open={!!requestId} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Join request</DialogTitle>
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
        if (!cancelled) setLoadError(err instanceof Error ? err.message : "Couldn't load the request.")
      })
    return () => {
      cancelled = true
    }
  }, [requestId])

  async function handleDecide(approve: boolean) {
    setDecideError(null)
    setDeciding(true)
    try {
      await decideJoinRequest(requestId, approve)
      onDecided(requestId)
      onOpenChange(false)
    } catch (err) {
      setDecideError(err instanceof Error ? err.message : "Couldn't record your decision. Try again.")
      setDeciding(false)
    }
  }

  if (loadError) {
    return <p className="mt-4 text-sm text-destructive">{loadError}</p>
  }

  if (!detail) {
    return <p className="mt-4 text-sm text-muted-foreground">Loading…</p>
  }

  return (
    <div className="mt-4 flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <span className="text-xs font-medium text-muted-foreground">Requested by</span>
        <div className="flex h-9 items-center gap-2 rounded-xl border border-input bg-muted px-3 text-sm text-foreground">
          {detail.requestingStudentName}
          <LevelBadge level={detail.requestingStudentLevel} />
        </div>
      </div>
      <div className="flex flex-col gap-1.5">
        <span className="text-xs font-medium text-muted-foreground">Class</span>
        <div className="flex h-9 items-center gap-2 rounded-xl border border-input bg-muted px-3 text-sm text-foreground">
          {detail.hostStudentName}
          <LevelBadge level={detail.hostStudentLevel} />
        </div>
      </div>
      <ReadOnlyField label="Court" value={detail.locationName} />
      <div className="grid grid-cols-2 gap-4">
        <ReadOnlyField label="Start" value={format(detail.startTime, "MMM d, h:mm a")} />
        <ReadOnlyField label="End" value={format(detail.endTime, "h:mm a")} />
      </div>

      <p className="text-sm text-foreground">Authorize this student to join the class?</p>

      {decideError && <p className="text-sm text-destructive">{decideError}</p>}

      <DialogFooter>
        <Button
          type="button"
          variant="destructive"
          onClick={() => handleDecide(false)}
          disabled={deciding}
        >
          No
        </Button>
        <Button type="button" onClick={() => handleDecide(true)} disabled={deciding}>
          {deciding ? "Saving…" : "Yes"}
        </Button>
      </DialogFooter>
    </div>
  )
}
