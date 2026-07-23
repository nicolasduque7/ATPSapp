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
