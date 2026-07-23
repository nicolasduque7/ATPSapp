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
