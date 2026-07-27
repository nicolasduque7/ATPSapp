"use client"

import { useState } from "react"
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
import { requestToJoinClass } from "@/lib/actions/join-requests"
import type { CalendarClassEvent } from "@/components/calendar/types"

interface OpenClassViewDialogProps {
  event: CalendarClassEvent | null
  onOpenChange: (open: boolean) => void
  onRequested?: () => void
}

export function OpenClassViewDialog({ event, onOpenChange, onRequested }: OpenClassViewDialogProps) {
  return (
    <Dialog open={!!event} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Open Class</DialogTitle>
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
  const [requesting, setRequesting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [requested, setRequested] = useState(false)
  const { studentName, level, coachName, locationName } = event.resource

  async function handleRequest() {
    setError(null)
    setRequesting(true)
    try {
      await requestToJoinClass(event.id)
      setRequested(true)
      onRequested?.()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't send the join request. Try again.")
    } finally {
      setRequesting(false)
    }
  }

  return (
    <>
      <div className="mt-4 flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-muted-foreground">Student</span>
          <div className="flex h-9 items-center gap-2 rounded-xl border border-input bg-muted px-3 text-sm text-foreground">
            {studentName}
            <LevelBadge level={level} />
          </div>
        </div>
        <ReadOnlyField label="Coach" value={coachName} />
        <ReadOnlyField label="Court" value={locationName} />
        <div className="grid grid-cols-2 gap-4">
          <ReadOnlyField label="Start" value={format(event.start, "MMM d, h:mm a")} />
          <ReadOnlyField label="End" value={format(event.end, "MMM d, h:mm a")} />
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}
        {requested && (
          <p className="text-sm text-positive">
            Request sent — you&apos;ll hear back once the coach decides.
          </p>
        )}
      </div>

      <DialogFooter>
        <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>
          {requested ? "Close" : "Cancel"}
        </Button>
        {!requested && (
          <Button type="button" onClick={handleRequest} disabled={requesting}>
            {requesting ? "Requesting…" : "Request to join"}
          </Button>
        )}
      </DialogFooter>
    </>
  )
}
