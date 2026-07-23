// `classes`/`class_series` store plain (timezone-less) date/timestamp columns
// — see the initial-schema migration's rationale. Postgres ignores any
// offset on a `timestamp without time zone` literal, so writing with
// `Date.toISOString()` would silently shift every class by the machine's
// UTC offset. These helpers keep read/write using the same local wall-clock
// numbers throughout the app.
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

export function toLocalTimestamp(date: Date): string {
  return `${formatDateOnly(date)}T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
}

export function addDays(date: Date, days: number): Date {
  const next = new Date(date)
  next.setDate(next.getDate() + days)
  return next
}

export function addMinutes(date: Date, minutes: number): Date {
  return new Date(date.getTime() + minutes * 60_000)
}

// `time` is "HH:mm"; only the calendar day of `day` is used.
export function combineDateAndTime(day: Date, time: string): Date {
  const [hours, minutes] = time.split(":").map(Number)
  const next = new Date(day)
  next.setHours(hours, minutes, 0, 0)
  return next
}

// Returns every occurrence of `weekday` (0 = Monday .. 6 = Sunday, matching
// class_series' convention) between `from` and `until`, inclusive, as
// midnight-local Date objects. Both bounds are normalized to calendar days
// first so a caller passing a live timestamp (e.g. `new Date()`) doesn't
// get tripped up by its time-of-day when compared against a day-only bound.
export function generateWeeklyOccurrences(from: Date, until: Date, weekday: number): Date[] {
  const fromDay = new Date(from.getFullYear(), from.getMonth(), from.getDate())
  const untilDay = new Date(until.getFullYear(), until.getMonth(), until.getDate())
  const fromWeekday = (fromDay.getDay() + 6) % 7
  const diff = (weekday - fromWeekday + 7) % 7

  const occurrences: Date[] = []
  for (let cursor = addDays(fromDay, diff); cursor <= untilDay; cursor = addDays(cursor, 7)) {
    occurrences.push(cursor)
  }
  return occurrences
}
