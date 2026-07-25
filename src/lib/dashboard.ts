import { STUDENT_LEVELS, type ClassInstance, type DailyClassCount, type LevelClassCount, type Student, type StudentLevel } from "@/lib/mock-data"

function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}

function getMondayOfWeek(date: Date): Date {
  const monday = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  const daysSinceMonday = (monday.getDay() + 6) % 7
  monday.setDate(monday.getDate() - daysSinceMonday)
  return monday
}

function getCurrentWorkingWeekRange(): { start: Date; end: Date } {
  const start = getMondayOfWeek(new Date())
  const end = new Date(start.getTime() + 7 * 24 * 60 * 60_000)
  return { start, end }
}

export function getClassesForToday(classes: ClassInstance[]): ClassInstance[] {
  const now = new Date()
  return classes
    .filter((c) => isSameDay(c.startTime, now))
    .sort((a, b) => a.startTime.getTime() - b.startTime.getTime())
}

export function getNextClass(classes: ClassInstance[]): ClassInstance | undefined {
  const now = new Date()
  return classes
    .filter((c) => c.startTime > now)
    .sort((a, b) => a.startTime.getTime() - b.startTime.getTime())[0]
}

export function getHoursCoachedToday(classes: ClassInstance[]): number {
  const now = new Date()
  const minutes = classes
    .filter((c) => isSameDay(c.startTime, now) && c.completed)
    .reduce((sum, c) => sum + c.durationMinutes, 0)
  return Math.round((minutes / 60) * 10) / 10
}

export function getClassesCoachedThisWeek(classes: ClassInstance[]): number {
  const { start, end } = getCurrentWorkingWeekRange()
  return classes.filter((c) => c.completed && c.startTime >= start && c.startTime < end).length
}

export function getStudentsCoachedThisWeek(classes: ClassInstance[]): number {
  const { start, end } = getCurrentWorkingWeekRange()
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
export function getCoachesTrainedWithThisWeek(classes: ClassInstance[]): number {
  const { start, end } = getCurrentWorkingWeekRange()
  const coachIds = new Set(
    classes
      .filter((c) => c.completed && c.startTime >= start && c.startTime < end)
      .map((c) => c.coachId)
  )
  return coachIds.size
}

const WEEKDAY_ABBREVIATIONS = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"]

export function getBusiestDayThisWeek(classes: ClassInstance[]): string | undefined {
  const { start, end } = getCurrentWorkingWeekRange()
  const counts = [0, 0, 0, 0, 0, 0, 0]

  for (const c of classes) {
    if (c.startTime >= start && c.startTime < end) {
      counts[(c.startTime.getDay() + 6) % 7] += 1
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

export function getDailyClassCounts(classes: ClassInstance[], maxDays: number): DailyClassCount[] {
  const now = new Date()
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate())

  const results: DailyClassCount[] = []
  for (let offset = -maxDays; offset <= maxDays; offset++) {
    const date = new Date(startOfToday)
    date.setDate(date.getDate() + offset)
    const nextDate = new Date(date)
    nextDate.setDate(nextDate.getDate() + 1)

    const count = classes.filter((c) => c.startTime >= date && c.startTime < nextDate).length

    results.push({ dayOffset: offset, date, count })
  }

  return results
}
