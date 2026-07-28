"use client"

import { useState } from "react"
import { formatClubDate } from "@/lib/dates"

import { JoinRequestDecisionDialog } from "@/components/notifications/join-request-decision-dialog"
import type { PendingJoinRequestSummary } from "@/lib/queries/notifications"

interface CoachJoinRequestsListProps {
  requests: PendingJoinRequestSummary[]
}

export function CoachJoinRequestsList({ requests: initialRequests }: CoachJoinRequestsListProps) {
  const [requests, setRequests] = useState(initialRequests)
  const [selectedRequestId, setSelectedRequestId] = useState<string | null>(null)

  function handleDecided(requestId: string) {
    setRequests((prev) => prev.filter((r) => r.id !== requestId))
  }

  return (
    <div className="flex flex-col gap-3">
      <h2 className="font-heading text-lg font-bold text-foreground">Student&apos;s Join Requests</h2>

      {requests.length === 0 ? (
        <div className="rounded-3xl bg-card p-6 text-sm text-muted-foreground">
          No pending join requests.
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {requests.map((request) => (
            <button
              key={request.id}
              type="button"
              onClick={() => setSelectedRequestId(request.id)}
              className="flex cursor-pointer items-center justify-between gap-3 rounded-2xl bg-card p-4 text-left transition-colors duration-200 hover:bg-accent focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50 motion-reduce:transition-none"
            >
              <span className="font-medium text-foreground">
                Requested by {request.requestingStudentName}
              </span>
              <span className="text-sm text-muted-foreground">
                {formatClubDate(request.classStartTime, "MMM d, h:mm a")}
              </span>
            </button>
          ))}
        </div>
      )}

      <JoinRequestDecisionDialog
        requestId={selectedRequestId}
        onOpenChange={(open) => {
          if (!open) setSelectedRequestId(null)
        }}
        onDecided={handleDecided}
      />
    </div>
  )
}
