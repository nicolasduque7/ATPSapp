"use client"

import { useState } from "react"
import { useLocale, useTranslations } from "next-intl"
import { formatClubDate } from "@/lib/dates"
import { getDateFnsLocale } from "@/lib/date-locale"

import { StatusIcon } from "@/components/notifications/status-icon"
import { SentRequestDetailDialog } from "@/components/notifications/sent-request-detail-dialog"
import { ReceivedJoinDetailDialog } from "@/components/notifications/received-join-detail-dialog"
import type { ReceivedJoinSummary, SentJoinRequestSummary } from "@/lib/queries/notifications"

interface StudentNotificationsViewProps {
  sentRequests: SentJoinRequestSummary[]
  receivedJoins: ReceivedJoinSummary[]
}

export function StudentNotificationsView({ sentRequests, receivedJoins }: StudentNotificationsViewProps) {
  const t = useTranslations("notifications")
  const dateFnsLocale = getDateFnsLocale(useLocale())
  const [selectedSentRequestId, setSelectedSentRequestId] = useState<string | null>(null)
  const [selectedReceivedClassId, setSelectedReceivedClassId] = useState<string | null>(null)

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3">
        <h2 className="font-heading text-lg font-bold text-foreground">{t("joinRequestsTitle")}</h2>
        {sentRequests.length === 0 ? (
          <div className="rounded-3xl bg-card p-6 text-sm text-muted-foreground">{t("haventRequested")}</div>
        ) : (
          <div className="flex flex-col gap-2">
            {sentRequests.map((request) => (
              <button
                key={request.requestId}
                type="button"
                onClick={() => setSelectedSentRequestId(request.requestId)}
                className="flex cursor-pointer items-center justify-between gap-3 rounded-2xl bg-card p-4 text-left transition-colors duration-200 hover:bg-accent focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50 motion-reduce:transition-none"
              >
                <span className="font-medium text-foreground">{request.hostStudentName}</span>
                <div className="flex items-center gap-3">
                  <span className="text-sm text-muted-foreground">
                    {formatClubDate(request.startTime, "MMM d, h:mm a", dateFnsLocale)}
                  </span>
                  <StatusIcon status={request.status} />
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      <SentRequestDetailDialog
        requestId={selectedSentRequestId}
        onOpenChange={(open) => {
          if (!open) setSelectedSentRequestId(null)
        }}
      />
      <ReceivedJoinDetailDialog
        classId={selectedReceivedClassId}
        onOpenChange={(open) => {
          if (!open) setSelectedReceivedClassId(null)
        }}
      />
    </div>
  )
}
