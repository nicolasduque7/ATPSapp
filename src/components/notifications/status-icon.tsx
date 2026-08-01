"use client"

import { Check, Clock, X } from "lucide-react"
import { useTranslations } from "next-intl"

import { cn } from "@/lib/utils"
import type { JoinRequestStatus } from "@/lib/queries/notifications"

interface StatusIconProps {
  status: JoinRequestStatus
  className?: string
}

const STATUS_STYLES: Record<JoinRequestStatus, { icon: typeof Clock; className: string; labelKey: "pending" | "approved" | "rejected" }> = {
  pending: { icon: Clock, className: "text-muted-foreground", labelKey: "pending" },
  approved: { icon: Check, className: "text-positive", labelKey: "approved" },
  rejected: { icon: X, className: "text-destructive", labelKey: "rejected" },
}

export function StatusIcon({ status, className }: StatusIconProps): React.JSX.Element {
  const t = useTranslations("notifications")
  const { icon: Icon, className: statusClassName, labelKey } = STATUS_STYLES[status]
  return (
    <span className={cn("inline-flex items-center gap-1 text-xs font-medium", statusClassName, className)}>
      <Icon className="size-3.5 shrink-0 stroke-[2]" />
      {t(labelKey)}
    </span>
  )
}
