"use client"

import { cn } from "@/lib/utils"
import type { StudentLevel } from "@/lib/mock-data"

export interface SelectableStudent {
  id: string
  name: string
  nickname?: string
  level: StudentLevel
}

interface StudentMultiSelectFieldProps {
  id: string
  label: string
  options: SelectableStudent[]
  selectedIds: string[]
  onToggle: (id: string) => void
  maxCount: number
  // When true, the FIRST id in selectedIds is visually flagged as the host
  // (coach dialog only — the student dialog has no host concept, self is
  // always implicit).
  showHostBadge?: boolean
  hostLabel?: string
  emptyMessage?: string
}

export function StudentMultiSelectField({
  id,
  label,
  options,
  selectedIds,
  onToggle,
  maxCount,
  showHostBadge = false,
  hostLabel,
  emptyMessage,
}: StudentMultiSelectFieldProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      {options.length === 0 && emptyMessage ? (
        <p className="text-sm text-muted-foreground">{emptyMessage}</p>
      ) : (
        <div id={id} role="group" aria-label={label} className="flex flex-wrap gap-2">
          {options.map((option) => {
            const selected = selectedIds.includes(option.id)
            const isHost = showHostBadge && selected && selectedIds[0] === option.id
            const disabled = !selected && selectedIds.length >= maxCount
            return (
              <button
                key={option.id}
                type="button"
                aria-pressed={selected}
                disabled={disabled}
                onClick={() => onToggle(option.id)}
                className={cn(
                  "inline-flex cursor-pointer items-center gap-1.5 rounded-full border-2 px-3 py-1.5 text-sm font-medium transition-all duration-200 motion-reduce:transition-none disabled:cursor-not-allowed disabled:opacity-50",
                  selected
                    ? "border-primary/40 bg-primary/10 text-primary"
                    : "border-transparent bg-muted text-muted-foreground hover:bg-accent"
                )}
              >
                {option.name} · {option.level}
                {isHost && hostLabel && (
                  <span className="rounded-full bg-primary/20 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary">
                    {hostLabel}
                  </span>
                )}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
