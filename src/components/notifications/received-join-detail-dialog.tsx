"use client"

import { useEffect, useState } from "react"
import { format } from "date-fns"

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
  return (
    <Dialog open={!!classId} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Class joined</DialogTitle>
        </DialogHeader>
        {classId && <ReceivedJoinDetailView key={classId} classId={classId} />}
      </DialogContent>
    </Dialog>
  )
}

function ReceivedJoinDetailView({ classId }: { classId: string }) {
  const [detail, setDetail] = useState<ReceivedJoinDetail | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    getReceivedJoinDetail(classId)
      .then((data) => {
        if (!cancelled) setDetail(data)
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Couldn't load this class.")
      })
    return () => {
      cancelled = true
    }
  }, [classId])

  if (error) return <p className="mt-4 text-sm text-destructive">{error}</p>
  if (!detail) return <p className="mt-4 text-sm text-muted-foreground">Loading…</p>

  return (
    <div className="mt-4 flex flex-col gap-4">
      <ReadOnlyField label="Court" value={detail.locationName} />
      <div className="grid grid-cols-2 gap-4">
        <ReadOnlyField label="Start" value={format(detail.startTime, "MMM d, h:mm a")} />
        <ReadOnlyField label="End" value={format(detail.endTime, "h:mm a")} />
      </div>

      <span className="text-xs font-medium text-muted-foreground">
        {detail.joiners.length === 1 ? "Joining student" : "Joining students"}
      </span>
      {detail.joiners.map((joiner) => (
        <StudentPartnerCard key={joiner.studentId} student={joiner} />
      ))}
    </div>
  )
}
