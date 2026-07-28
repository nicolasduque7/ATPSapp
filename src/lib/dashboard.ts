import { isSameClubDay, clubWeekdayIndex, startOfClubDay } from "@/lib/dates"
import { STUDENT_LEVELS, type ClassInstance, type DailyClassCount, type LevelClassCount, type Student, type StudentLevel } from "@/lib/mock-data"

function getCurrentWorkingWeekRange(now: Date): { start: Date; end: Date } {
  const start = new Date(startOfClubDay(now).getTime() - clubWeekdayIndex(now) * 24 * 60 * 60_000)
  const end = new Date(start.getTime() + 7 * 24 * 60 * 60_000)
  return { start, end }
}

export function getClassesForToday(classes: ClassInstance[], now: Date = new Date()): ClassInstance[] {
  return classes
    .filter((c) => isSameClubDay(c.startTime, now))
    .sort((a, b) => a.startTime.getTime() - b.startTime.getTime())
}

export function getNextClass(classes: ClassInstance[], now: Date = new Date()): ClassInstance | undefined {
  return classes
    .filter((c) => c.startTime > now)
    .sort((a, b) => a.startTime.getTime() - b.startTime.getTime())[0]
}

export function getHoursCoachedToday(classes: ClassInstance[], now: Date = new Date()): number {
  const minutes = classes
    .filter((c) => isSameClubDay(c.startTime, now) && c.completed)
    .reduce((sum, c) => sum + c.durationMinutes, 0)
  return Math.round((minutes / 60) * 10) / 10
}

export function getClassesCoachedThisWeek(classes: ClassInstance[], now: Date = new Date()): number {
  const { start, end } = getCurrentWorkingWeekRange(now)
  return classes.filter((c) => c.completed && c.startTime >= start && c.startTime < end).length
}

export function getStudentsCoachedThisWeek(classes: ClassInstance[], now: Date = new Date()): number {
  const { start, end } = getCurrentWorkingWeekRange(now)
  const studentIds = new Set(
    classes
      .filter((c) => c.completed && c.startTime >= start && c.startTime < end)
      .map((c) => c.studentId)
  )
  return studentIds.size
}

// The student-side analog of getStudentsCoachedThisWeek: on a student's own
// classes array every row has the same studentId (themselves), so counting
// distinct students is meaningless there — distinct coaches is the useful
// stat instead.
export function getCoachesTrainedWithThisWeek(classes: ClassInstance[], now: Date = new Date()): number {
  const { start, end } = getCurrentWorkingWeekRange(now)
  const coachIds = new Set(
    classes
      .filter((c) => c.completed && c.startTime >= start && c.startTime < end)
      .map((c) => c.coachId)
  )
  return coachIds.size
}

const WEEKDAY_ABBREVIATIONS = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"]

export function getBusiestDayThisWeek(classes: ClassInstance[], now: Date = new Date()): string | undefined {
  const { start, end } = getCurrentWorkingWeekRange(now)
  const counts = [0, 0, 0, 0, 0, 0, 0]

  for (const c of classes) {
    if (c.startTime >= start && c.startTime < end) {
      counts[clubWeekdayIndex(c.startTime)] += 1
    }
  }

  const busiestIndex = counts.reduce(
    (best, count, index) => (count > counts[best] ? index : best),
    0
  )
  return counts[busiestIndex] > 0 ? WEEKDAY_ABBREVIATIONS[busiestIndex] : undefined
}

export function getClassCountsByLevel(classes: ClassInstance[], students: Student[]): LevelClassCount[] {
  const counts: Record<StudentLevel, number> = {
    "1ra": 0,
    "2da": 0,
    "3ra": 0,
    "4ta": 0,
    "5ta": 0,
    "6ta": 0,
  }
  const studentById = new Map(students.map((s) => [s.id, s]))

  for (const c of classes) {
    const student = studentById.get(c.studentId)
    if (student) counts[student.level] += 1
  }

  return STUDENT_LEVELS.map((level) => ({ level, count: counts[level] }))
}

export function getDailyClassCounts(
  classes: ClassInstance[],
  maxDays: number,
  now: Date = new Date()
): DailyClassCount[] {
  const startOfToday = startOfClubDay(now)

  // `startOfToday` is a real instant (club-local midnight); step it in exact
  // 24h increments rather than via ambient `setDate` — CLUB_TIMEZONE has no
  // DST so this is exact, and it keeps `date`/`nextDate` safe real instants
  // (no local-getter mutation on a value that crosses environments).
  const results: DailyClassCount[] = []
  const dayMs = 24 * 60 * 60_000
  for (let offset = -maxDays; offset <= maxDays; offset++) {
    const date = new Date(startOfToday.getTime() + offset * dayMs)
    const nextDate = new Date(date.getTime() + dayMs)

    const count = classes.filter((c) => c.startTime >= date && c.startTime < nextDate).length

    results.push({ dayOffset: offset, date, count })
  }

  return results
}
