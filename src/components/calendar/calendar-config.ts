import { format, getDay, parse, startOfWeek } from "date-fns"
import { enUS } from "date-fns/locale"
import { dateFnsLocalizer } from "react-big-calendar"

import { ThreeDayView } from "@/components/calendar/three-day-view"

const locales = { "en-US": enUS }

export const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek,
  getDay,
  locales,
})

export const MIN_TIME = new Date(1970, 0, 1, 7, 0, 0)
export const MAX_TIME = new Date(1970, 0, 1, 21, 0, 0)

// react-big-calendar's bundled types only model its 5 built-in views, but the
// library itself accepts any custom view object at runtime (this is the
// documented pattern for adding a view, e.g. a 3-day view, on top of its
// TimeGrid renderer) — cast through unknown to bridge that type gap.
export const CALENDAR_VIEWS = {
  month: true,
  week: true,
  day: true,
  "three-day": ThreeDayView,
} as unknown as Record<string, boolean>
