import { cn } from "@/lib/utils"
import { getSurfaceColorStyle } from "@/lib/surface-colors"
import type { CourtSurface } from "@/lib/mock-data"

interface SurfacePillProps {
  surface: CourtSurface
  totalCourts: number
  className?: string
}

export function SurfacePill({ surface, totalCourts, className }: SurfacePillProps): React.JSX.Element {
  const courtsLabel = `${totalCourts} ${totalCourts === 1 ? "court" : "courts"}`

  if (surface === "Both") {
    const hard = getSurfaceColorStyle("Hard")
    const clay = getSurfaceColorStyle("Clay")
    return (
      <span
        className={cn(
          "inline-flex w-fit items-center gap-1.5 rounded-full border border-border bg-muted px-2.5 py-0.5 text-xs font-medium text-foreground",
          className
        )}
      >
        <span className="flex items-center -space-x-1">
          <span className={cn("size-2 rounded-full ring-2 ring-muted", hard.dot)} />
          <span className={cn("size-2 rounded-full ring-2 ring-muted", clay.dot)} />
        </span>
        Both · {courtsLabel}
      </span>
    )
  }

  const style = getSurfaceColorStyle(surface)
  return (
    <span
      className={cn(
        "inline-flex w-fit items-center gap-1.5 rounded-full border border-transparent px-2.5 py-0.5 text-xs font-medium",
        style.tint,
        style.text,
        className
      )}
    >
      <span className={cn("size-2 shrink-0 rounded-full", style.dot)} />
      {surface} · {courtsLabel}
    </span>
  )
}
