import { ChevronLeft, ChevronRight } from "lucide-react"
import { Navigate, type ToolbarProps, type View } from "react-big-calendar"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import type { CalendarEvent, CalendarViewKey } from "@/components/calendar/types"

const VIEW_OPTIONS: { key: CalendarViewKey; label: string }[] = [
  { key: "month", label: "Month" },
  { key: "week", label: "Week" },
  { key: "three-day", label: "3-Day" },
  { key: "day", label: "Day" },
]

export function CalendarToolbar({
  label,
  view,
  onNavigate,
  onView,
}: ToolbarProps<CalendarEvent>) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 pb-4">
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => onNavigate(Navigate.TODAY)}
        >
          Today
        </Button>
        <div className="flex items-center">
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label="Previous"
            onClick={() => onNavigate(Navigate.PREVIOUS)}
          >
            <ChevronLeft />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label="Next"
            onClick={() => onNavigate(Navigate.NEXT)}
          >
            <ChevronRight />
          </Button>
        </div>
        <h2 className="font-heading text-base font-bold text-foreground">{label}</h2>
      </div>

      <div className="flex items-center gap-1 rounded-full bg-muted p-1">
        {VIEW_OPTIONS.map((option) => (
          <button
            key={option.key}
            type="button"
            aria-current={view === option.key ? "true" : undefined}
            onClick={() => onView(option.key as unknown as View)}
            className={cn(
              "cursor-pointer rounded-full px-3 py-1.5 text-xs font-medium transition-colors duration-200 outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-muted",
              view === option.key
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  )
}
