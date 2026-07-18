"use client"

import { Navigate, type DateLocalizer, type NavigateAction } from "react-big-calendar"
import TimeGrid from "react-big-calendar/lib/TimeGrid"

const NUM_DAYS = 3

interface ThreeDayViewProps {
  date: Date
  localizer: DateLocalizer
  [key: string]: unknown
}

function getRange(date: Date, { localizer }: { localizer: DateLocalizer }): Date[] {
  const end = localizer.add(date, NUM_DAYS - 1, "day")
  return localizer.range(date, end)
}

export function ThreeDayView({ date, localizer, ...props }: ThreeDayViewProps) {
  return (
    <TimeGrid
      {...props}
      range={getRange(date, { localizer })}
      eventOffset={15}
      localizer={localizer}
    />
  )
}

ThreeDayView.range = getRange

ThreeDayView.navigate = (date: Date, action: NavigateAction, { localizer }: { localizer: DateLocalizer }): Date => {
  switch (action) {
    case Navigate.PREVIOUS:
      return localizer.add(date, -NUM_DAYS, "day")
    case Navigate.NEXT:
      return localizer.add(date, NUM_DAYS, "day")
    default:
      return date
  }
}

ThreeDayView.title = (date: Date, { localizer }: { localizer: DateLocalizer }): string => {
  const days = getRange(date, { localizer })
  return localizer.format(
    { start: days[0], end: days[days.length - 1] },
    "dayRangeHeaderFormat"
  )
}
