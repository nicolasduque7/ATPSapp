"use client"

import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { cn } from "@/lib/utils"
import { getCoachColorStyle } from "@/lib/coach-colors"
import type { Coach } from "@/lib/mock-data"

interface CoachFilterPopoverProps {
  label: string
  coaches: Coach[]
  allCoaches: Coach[] // full roster, so color assignment stays consistent across both toggles
  selectedIds: Set<string>
  onToggle: (coachId: string) => void
  emptyLabel: string
}

export function CoachFilterPopover({
  label,
  coaches,
  allCoaches,
  selectedIds,
  onToggle,
  emptyLabel,
}: CoachFilterPopoverProps) {
  const activeCount = coaches.filter((coach) => selectedIds.has(coach.id)).length

  return (
    <Popover>
      <PopoverTrigger
        type="button"
        className={cn(
          "inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-transparent px-3 py-1.5 text-xs font-medium transition-colors duration-200 outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card",
          activeCount > 0
            ? "bg-primary text-primary-foreground"
            : "bg-muted text-muted-foreground hover:bg-accent hover:text-foreground"
        )}
      >
        {label}
        {activeCount > 0 && (
          <span className="inline-flex size-4 items-center justify-center rounded-full bg-primary-foreground/20 text-[10px]">
            {activeCount}
          </span>
        )}
      </PopoverTrigger>
      <PopoverContent align="start" className="w-56">
        {coaches.length === 0 ? (
          <p className="px-1 py-1 text-sm text-muted-foreground">{emptyLabel}</p>
        ) : (
          <div className="flex flex-col gap-1">
            {coaches.map((coach) => {
              const style = getCoachColorStyle(coach.id, allCoaches)
              const selected = selectedIds.has(coach.id)
              return (
                <button
                  key={coach.id}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => onToggle(coach.id)}
                  className={cn(
                    "flex cursor-pointer items-center gap-2 rounded-xl px-2 py-1.5 text-left text-sm transition-colors duration-200 motion-reduce:transition-none",
                    selected ? cn(style.tint, style.text) : "text-foreground hover:bg-accent"
                  )}
                >
                  <span className={cn("size-2.5 shrink-0 rounded-full", style.dot)} />
                  <span className="truncate">{coach.name}</span>
                </button>
              )
            })}
          </div>
        )}
      </PopoverContent>
    </Popover>
  )
}
