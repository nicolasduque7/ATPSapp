import { format, getDay, parse, startOfWeek, type Locale } from "date-fns"
import { enUS } from "date-fns/locale"
import { dateFnsLocalizer } from "react-big-calendar"

import { ThreeDayView } from "@/components/calendar/three-day-view"
import { toClubZoned } from "@/lib/dates"

const locales = { "en-US": enUS }

// react-big-calendar's grid math (day columns, week start, time-of-day
// positioning) runs entirely client-side and reads local Date getters
// internally via date-fns' format/getDay/startOfWeek. Event Dates
// (ClassInstance.startTime/.endTime) are real instants, so those getters
// would otherwise resolve in the viewer's own device timezone rather than
// CLUB_TIMEZONE. Routing every date through `toClubZoned` first — entirely
// within this one client-side call, never crossing a server/client boundary
// — makes the grid always reflect club-local time regardless of the
// viewer's device timezone.
export const localizer = dateFnsLocalizer({
  format: (date: Date, formatStr: string, options?: { locale?: Locale }) =>
    format(toClubZoned(date), formatStr, options),
  parse: (value: string, formatStr: string, backupDate: Date, options?: { locale?: Locale }) =>
    parse(value, formatStr, backupDate, options),
  startOfWeek: (date?: Date, options?: { locale?: Locale }) => startOfWeek(toClubZoned(date ?? new Date()), options),
  getDay: (date: Date) => getDay(toClubZoned(date)),
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
