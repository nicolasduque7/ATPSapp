"use client"

import { useEffect, useRef, useState } from "react"
import Link from "next/link"
import { ChevronRight } from "lucide-react"

import { cn } from "@/lib/utils"
import { useHasMounted } from "@/lib/hooks/use-has-mounted"
import type { ClassInstance } from "@/lib/mock-data"

interface ScheduleEntity {
  id: string
  name: string
}

interface SchedulePillsProps {
  classes: ClassInstance[]
  entities: ScheduleEntity[]
  // A plain key rather than a function — this component is rendered from a
  // server component (the Home pages), and functions can't cross that
  // server/client boundary as props.
  entityIdKey?: "studentId" | "coachId"
  calendarHref?: string
}

function formatPillTime(date: Date): string {
  const hours = date.getHours() % 12 || 12
  const minutes = date.getMinutes().toString().padStart(2, "0")
  return `${hours}:${minutes}`
}

export function SchedulePills({
  classes,
  entities,
  entityIdKey = "studentId",
  calendarHref = "/calendar",
}: SchedulePillsProps) {
  const hasMounted = useHasMounted()
  const [now, setNow] = useState(() => new Date())
  const [canScrollRight, setCanScrollRight] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  const entityById = new Map(entities.map((e) => [e.id, e]))

  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 30_000)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    const el = scrollRef.current
    if (!el) return

    const checkOverflow = () => setCanScrollRight(el.scrollWidth > el.clientWidth + 1)
    checkOverflow()

    const observer = new ResizeObserver(checkOverflow)
    observer.observe(el)
    return () => observer.disconnect()
  }, [classes])

  const sorted = [...classes].sort(
    (a, b) => a.startTime.getTime() - b.startTime.getTime()
  )
  const completedCount = hasMounted ? sorted.filter((c) => now >= c.endTime).length : 0

  return (
    <div className="animate-in fade-in slide-in-from-bottom-2 fill-mode-both duration-300 delay-300 motion-reduce:animate-none rounded-3xl bg-card p-6">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-baseline gap-2">
          <h2 className="font-heading text-lg font-bold text-foreground">Schedule</h2>
          {sorted.length > 0 && (
            <span className="text-sm text-muted-foreground">
              {completedCount} of {sorted.length} done
            </span>
          )}
        </div>
        <Link
          href={calendarHref}
          aria-label="View calendar"
          className="rounded-full text-muted-foreground outline-none transition-colors duration-200 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card"
        >
          <ChevronRight className="size-5" />
        </Link>
      </div>

      {sorted.length === 0 ? (
        <p className="mt-4 text-sm text-muted-foreground">No classes today.</p>
      ) : (
        <div className="relative mt-6">
          <div
            ref={scrollRef}
            onScroll={(e) => {
              const el = e.currentTarget
              setCanScrollRight(el.scrollWidth - el.clientWidth - el.scrollLeft > 1)
            }}
            className="overflow-x-auto"
          >
            <div className="flex items-center gap-4">
              {sorted.map((c, index) => {
                const completed = hasMounted && now >= c.endTime
                const entity = entityById.get(c[entityIdKey])
                return (
                  <div
                    key={c.id}
                    title={entity?.name}
                    style={{ "--tw-animation-delay": `${index * 40}ms` } as React.CSSProperties}
                    className="flex min-w-14 flex-1 animate-in fade-in fill-mode-both flex-col items-center gap-2 duration-300 motion-reduce:animate-none"
                  >
                    <span
                      className={cn(
                        "h-1.5 w-full rounded-full transition-colors duration-300 motion-reduce:transition-none",
                        completed ? "bg-primary" : "bg-muted"
                      )}
                    />
                    <span
                      className={cn(
                        "text-xs transition-colors duration-300 motion-reduce:transition-none",
                        completed ? "font-semibold text-foreground" : "text-muted-foreground"
                      )}
                    >
                      {hasMounted ? formatPillTime(c.startTime) : ""}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>

          {canScrollRight && (
            <div className="pointer-events-none absolute top-0 right-0 h-full w-10 bg-gradient-to-l from-card to-transparent" />
          )}
        </div>
      )}
    </div>
  )
}
