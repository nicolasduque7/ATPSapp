"use client"

import { useEffect, useRef, useState } from "react"
import Link from "next/link"
import { ChevronRight } from "lucide-react"

import { cn } from "@/lib/utils"
import type { ClassInstance, Student } from "@/lib/mock-data"

interface SchedulePillsProps {
  classes: ClassInstance[]
  students: Student[]
}

function formatPillTime(date: Date): string {
  const hours = date.getHours() % 12 || 12
  const minutes = date.getMinutes().toString().padStart(2, "0")
  return `${hours}:${minutes}`
}

export function SchedulePills({ classes, students }: SchedulePillsProps) {
  const [now, setNow] = useState(() => new Date())
  const [canScrollRight, setCanScrollRight] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  const studentById = new Map(students.map((s) => [s.id, s]))

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
  const completedCount = sorted.filter((c) => now >= c.endTime).length

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
          href="/calendar"
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
                const completed = now >= c.endTime
                const student = studentById.get(c.studentId)
                return (
                  <div
                    key={c.id}
                    title={student?.name}
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
                      {formatPillTime(c.startTime)}
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
