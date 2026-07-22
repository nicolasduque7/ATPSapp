"use client"

import { useState } from "react"
import { format } from "date-fns"
import { Calendar, ChevronLeft, ChevronRight } from "lucide-react"

import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { cn } from "@/lib/utils"

interface MonthYearPickerProps {
  value: Date
  onChange: (date: Date) => void
  className?: string
}

const MONTH_LABELS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
]

export function MonthYearPicker({ value, onChange, className }: MonthYearPickerProps) {
  const [open, setOpen] = useState(false)
  const [displayYear, setDisplayYear] = useState(value.getFullYear())

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (next) setDisplayYear(value.getFullYear())
      }}
    >
      <PopoverTrigger
        type="button"
        className={cn(
          "flex h-auto w-full cursor-pointer items-center gap-1.5 border-0 bg-transparent p-0 text-left text-base font-bold text-foreground outline-none",
          className
        )}
      >
        <Calendar className="size-3.5 shrink-0 text-muted-foreground" />
        {format(value, "MMM yyyy")}
      </PopoverTrigger>
      <PopoverContent className="w-56">
        <div className="flex items-center justify-between px-1">
          <button
            type="button"
            aria-label="Previous year"
            onClick={() => setDisplayYear((y) => y - 1)}
            className="inline-flex size-6 cursor-pointer items-center justify-center rounded-full text-muted-foreground transition-colors duration-200 hover:bg-muted hover:text-foreground motion-reduce:transition-none"
          >
            <ChevronLeft className="size-4" />
          </button>
          <span className="text-sm font-semibold text-foreground">{displayYear}</span>
          <button
            type="button"
            aria-label="Next year"
            onClick={() => setDisplayYear((y) => y + 1)}
            className="inline-flex size-6 cursor-pointer items-center justify-center rounded-full text-muted-foreground transition-colors duration-200 hover:bg-muted hover:text-foreground motion-reduce:transition-none"
          >
            <ChevronRight className="size-4" />
          </button>
        </div>
        <div className="mt-2 grid grid-cols-4 gap-1">
          {MONTH_LABELS.map((label, index) => {
            const selected = displayYear === value.getFullYear() && index === value.getMonth()
            return (
              <button
                key={label}
                type="button"
                aria-pressed={selected}
                onClick={() => {
                  onChange(new Date(displayYear, index, 1))
                  setOpen(false)
                }}
                className={cn(
                  "cursor-pointer rounded-lg px-2 py-1.5 text-sm font-medium transition-colors duration-200 motion-reduce:transition-none",
                  selected
                    ? "bg-primary text-primary-foreground"
                    : "text-foreground hover:bg-muted"
                )}
              >
                {label}
              </button>
            )
          })}
        </div>
      </PopoverContent>
    </Popover>
  )
}
