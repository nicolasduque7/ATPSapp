import { Check, Clock, X } from "lucide-react"

import { cn } from "@/lib/utils"
import type { JoinRequestStatus } from "@/lib/queries/notifications"

interface StatusIconProps {
  status: JoinRequestStatus
  className?: string
}

const STATUS_STYLES: Record<JoinRequestStatus, { icon: typeof Clock; className: string; label: string }> = {
  pending: { icon: Clock, className: "text-muted-foreground", label: "Pending" },
  approved: { icon: Check, className: "text-positive", label: "Approved" },
  rejected: { icon: X, className: "text-destructive", label: "Rejected" },
}

export function StatusIcon({ status, className }: StatusIconProps): React.JSX.Element {
  const { icon: Icon, className: statusClassName, label } = STATUS_STYLES[status]
  return (
    <span className={cn("inline-flex items-center gap-1 text-xs font-medium", statusClassName, className)}>
      <Icon className="size-3.5 shrink-0 stroke-[2]" />
      {label}
    </span>
  )
}
