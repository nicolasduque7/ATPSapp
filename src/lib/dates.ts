import { fromZonedTime, formatInTimeZone, toZonedTime } from "date-fns-tz"

// `classes`/`class_series` store plain (timezone-less) date/timestamp columns
// — see the initial-schema migration's rationale. Postgres ignores any
// offset on a `timestamp without time zone` literal, so writing with
// `Date.toISOString()` would silently shift every class by the machine's
// UTC offset.
//
// This app is single-club/single-region (see PROJECT.md), so every "plain"
// timestamp is anchored to ONE explicit IANA zone rather than whatever zone
// happens to be ambient on the machine reading/writing it. That distinction
// matters because a `Date` object crossing a Server Component -> Client
// Component boundary (or vice versa) keeps its real UTC instant, but has NO
// wall-clock meaning until something reads local getters (`getHours`,
// `getDate`, ...) on it — and those resolve using whichever machine's
// ambient offset happens to be running that code. Vercel runs UTC; a
// visiting browser can be anywhere. `CLUB_TIMEZONE` fixes that ambiguity.
//
// Bogotá observes no DST, so exact-24h day/week arithmetic below is always
// safe for this specific zone — but the helpers still go through
// `date-fns-tz`'s real timezone-database conversions rather than hardcoded
// 24h assumptions, so nothing quietly breaks if this constant is ever
// pointed at a DST-observing zone.
export const CLUB_TIMEZONE = "America/Bogota" as const

// `zonedNow`/`toClubZoned` build a Date via `toZonedTime`, which bakes
// club-local wall-clock numbers into a Date using the CALLING runtime's own
// local Date constructor. Reading that Date's getters is only correct in
// the SAME runtime that constructed it (safe: entirely within one server
// request, or entirely within one browser tab/component, even across
// re-renders). NEVER pass one of these across a server/client boundary (a
// prop, a server action argument/return) and read its getters on the other
// side — that reintroduces the exact bug this file exists to prevent. Values
// that do need to cross a boundary should be reduced to a primitive (a
// number, a formatted string) or built via `fromZonedTime`/`formatInTimeZone`
// instead, which are timezone-database-driven and safe anywhere.
export function zonedNow(): Date {
  return toZonedTime(new Date(), CLUB_TIMEZONE)
}

export function toClubZoned(date: Date): Date {
  return toZonedTime(date, CLUB_TIMEZONE)
}

function pad(n: number): string {
  return n.toString().padStart(2, "0")
}

export function formatDateOnly(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

export function parseDateOnly(value: string): Date {
  const [year, month, day] = value.split("-").map(Number)
  return new Date(year, month - 1, day)
}

// Read path: turns a naive DB timestamp string ("2026-07-28T16:00:00", no
// zone) into a real, unambiguous instant, anchored to CLUB_TIMEZONE rather
// than whatever zone the reading machine happens to be in. Safe to cross a
// server/client boundary afterward.
export function parseDbTimestamp(value: string): Date {
  return fromZonedTime(value, CLUB_TIMEZONE)
}

// Write path: the club-zoned counterpart of the old `toLocalTimestamp` — a
// rename, not just a refactor, since the semantics change from "whatever
// zone this process happens to run in" to "always CLUB_TIMEZONE."
export function formatDbTimestamp(date: Date): string {
  return formatInTimeZone(date, CLUB_TIMEZONE, "yyyy-MM-dd'T'HH:mm:ss")
}

export function formatClubTime(date: Date): string {
  return formatInTimeZone(date, CLUB_TIMEZONE, "h:mm a")
}

export function formatClubDate(date: Date, formatStr: string): string {
  return formatInTimeZone(date, CLUB_TIMEZONE, formatStr)
}

// Real instant of club-local midnight for the club-calendar-day containing
// `instant` (defaults to now). Safe to cross a server/client boundary and to
// compare (`<`, `>=`, `getTime()`) against any other real-instant Date.
export function startOfClubDay(instant: Date = new Date()): Date {
  const zoned = toClubZoned(instant)
  return fromZonedTime(
    `${zoned.getFullYear()}-${pad(zoned.getMonth() + 1)}-${pad(zoned.getDate())}T00:00:00`,
    CLUB_TIMEZONE
  )
}

export function isSameClubDay(a: Date, b: Date): boolean {
  return startOfClubDay(a).getTime() === startOfClubDay(b).getTime()
}

// 0 = Monday .. 6 = Sunday, in club-local terms.
export function clubWeekdayIndex(date: Date): number {
  return (toClubZoned(date).getDay() + 6) % 7
}

export function addDays(date: Date, days: number): Date {
  const next = new Date(date)
  next.setDate(next.getDate() + days)
  return next
}

export function addMinutes(date: Date, minutes: number): Date {
  return new Date(date.getTime() + minutes * 60_000)
}

// `time` is "HH:mm"; only the calendar day of `day` is used. Plain,
// ambient-runtime local arithmetic — correct as long as `day` and the
// result are both only ever read within the SAME runtime that built them
// (e.g. entirely client-side, before a submit). Never send the result of
// this across a server/client boundary as a persisted value — use
// `combineClubDateAndTime` for that.
export function combineDateAndTime(day: Date, time: string): Date {
  const [hours, minutes] = time.split(":").map(Number)
  const next = new Date(day)
  next.setHours(hours, minutes, 0, 0)
  return next
}

// Write-path counterpart of `combineDateAndTime`: `day`'s Y/M/D are read via
// plain local getters (correct as long as `day` itself was built and is
// being read within one runtime — e.g. a client-side `zonedNow()`/`addDays`
// chain), then anchored to CLUB_TIMEZONE via `fromZonedTime`. The result is
// a real, safe-to-cross-boundaries instant — use this (not
// `combineDateAndTime`) for anything that ends up as
// `ClassInstanceInput.startTime`/`.endTime` or an `AvailabilityBlockInput`
// field sent to a server action.
export function combineClubDateAndTime(day: Date, time: string): Date {
  const naive = `${day.getFullYear()}-${pad(day.getMonth() + 1)}-${pad(day.getDate())}T${time}:00`
  return fromZonedTime(naive, CLUB_TIMEZONE)
}

function dateOnly(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}

export type SeriesFrequency = "Daily" | "Weekly" | "Monthly"

export interface RecurrencePattern {
  frequency: SeriesFrequency
  intervalCount: number
  // Required (non-empty) when frequency is "Weekly": 0 = Monday .. 6 = Sunday.
  weekdays?: number[] | null
  // Required when frequency is "Monthly": 1-30.
  dayOfMonth?: number | null
}

function generateDailyOccurrences(from: Date, until: Date, intervalDays: number): Date[] {
  const fromDay = dateOnly(from)
  const untilDay = dateOnly(until)

  const occurrences: Date[] = []
  for (let cursor = fromDay; cursor <= untilDay; cursor = addDays(cursor, intervalDays)) {
    occurrences.push(cursor)
  }
  return occurrences
}

// Every occurrence of any of `weekdays` (0 = Monday .. 6 = Sunday) between
// `from` and `until`, inclusive, repeating every `intervalWeeks` weeks. The
// first cycle is anchored to the Monday of `from`'s own week so a multi-day
// pattern (e.g. Mon + Wed) lands on the correct pair from the start, then
// each later cycle jumps `intervalWeeks` weeks at a time.
function generateWeeklyOccurrences(
  from: Date,
  until: Date,
  weekdays: number[],
  intervalWeeks: number,
): Date[] {
  const fromDay = dateOnly(from)
  const untilDay = dateOnly(until)
  const fromWeekday = (fromDay.getDay() + 6) % 7
  const anchorWeekStart = addDays(fromDay, -fromWeekday)
  const sortedWeekdays = [...weekdays].sort((a, b) => a - b)

  const occurrences: Date[] = []
  for (
    let cycleStart = anchorWeekStart;
    cycleStart <= untilDay;
    cycleStart = addDays(cycleStart, 7 * intervalWeeks)
  ) {
    for (const weekday of sortedWeekdays) {
      const occurrence = addDays(cycleStart, weekday)
      if (occurrence >= fromDay && occurrence <= untilDay) {
        occurrences.push(occurrence)
      }
    }
  }
  return occurrences
}

function lastDayOfMonth(year: number, monthIndex0: number): number {
  return new Date(year, monthIndex0 + 1, 0).getDate()
}

// Every occurrence of `dayOfMonth` between `from` and `until`, inclusive,
// repeating every `intervalMonths` months. A month too short for the chosen
// day (e.g. day 30 in February) clamps to that month's last day rather than
// skipping it.
function generateMonthlyOccurrences(
  from: Date,
  until: Date,
  dayOfMonth: number,
  intervalMonths: number,
): Date[] {
  const fromDay = dateOnly(from)
  const untilDay = dateOnly(until)

  const occurrences: Date[] = []
  let year = fromDay.getFullYear()
  let month = fromDay.getMonth()

  while (true) {
    const clampedDay = Math.min(dayOfMonth, lastDayOfMonth(year, month))
    const occurrence = new Date(year, month, clampedDay)
    if (occurrence > untilDay) break
    if (occurrence >= fromDay) occurrences.push(occurrence)

    month += intervalMonths
    year += Math.floor(month / 12)
    month = ((month % 12) + 12) % 12
  }
  return occurrences
}

// Returns every occurrence of `pattern` between `from` and `until`,
// inclusive, as midnight-local Date objects. Both bounds may carry a
// time-of-day (e.g. a live `new Date()`) — only their calendar day matters.
export function generateOccurrences(pattern: RecurrencePattern, from: Date, until: Date): Date[] {
  switch (pattern.frequency) {
    case "Daily":
      return generateDailyOccurrences(from, until, pattern.intervalCount)
    case "Weekly":
      return generateWeeklyOccurrences(from, until, pattern.weekdays ?? [], pattern.intervalCount)
    case "Monthly":
      return generateMonthlyOccurrences(from, until, pattern.dayOfMonth ?? 1, pattern.intervalCount)
  }
}
