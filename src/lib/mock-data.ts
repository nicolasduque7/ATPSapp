export type StudentLevel = "1ra" | "2da" | "3ra" | "4ta" | "5ta" | "6ta"

export type ClassType = "Private" | "Group" | "Match"

export type Gender = "Female" | "Male"

export type Hand = "Right" | "Left"

export interface Coach {
  id: string
  name: string
  email: string
}

export type CourtSurface = "Hard" | "Clay" | "Both"

export interface Location {
  id: string
  name: string
  address?: string
  surface: CourtSurface
  hardCourts: number
  clayCourts: number
}

export interface Student {
  id: string
  name: string
  nickname?: string
  level: StudentLevel
  age: number
  gender: Gender
  hand: Hand
  racketType?: string
  since: Date
  coachingNote?: string
}

export interface ClassInstance {
  id: string
  studentId: string
  locationId: string
  type: ClassType
  startTime: Date
  endTime: Date
  durationMinutes: number
  completed: boolean
  notes?: string
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export const mockCoach: Coach = {
  id: "coach-1",
  name: "Alex Rivera",
  email: "alex@courtside.dev",
}

export const mockLocations: Location[] = [
  { id: "loc-1", name: "Riverside Courts", address: "100 Riverside Dr", surface: "Both", hardCourts: 3, clayCourts: 2 },
  { id: "loc-2", name: "Westside Park", address: "220 Westside Ave", surface: "Hard", hardCourts: 4, clayCourts: 0 },
  { id: "loc-3", name: "Oakwood Tennis Club", address: "44 Oakwood Ln", surface: "Clay", hardCourts: 0, clayCourts: 5 },
  { id: "loc-4", name: "Downtown Rec Center", address: "12 Main St", surface: "Hard", hardCourts: 2, clayCourts: 0 },
]

export const mockStudents: Student[] = [
  { id: "stu-1", name: "Ana Reyes", nickname: "Ani", level: "4ta", age: 14, gender: "Female", hand: "Right", racketType: "Wilson Clash 100", since: new Date(2023, 8, 1), coachingNote: "Focusing on topspin forehand consistency." },
  { id: "stu-2", name: "Leo Martins", nickname: "Leo", level: "6ta", age: 9, gender: "Male", hand: "Right", racketType: "Babolat Pure Drive Jr", since: new Date(2024, 5, 1) },
  { id: "stu-3", name: "Priya Nair", level: "1ra", age: 17, gender: "Female", hand: "Left", racketType: "Head Speed Pro", since: new Date(2021, 2, 1), coachingNote: "Preparing for regional qualifiers; serve placement drills." },
  { id: "stu-4", name: "Marcus Chen", nickname: "Marc", level: "4ta", age: 22, gender: "Male", hand: "Right", racketType: "Yonex Ezone 98", since: new Date(2022, 10, 1) },
  { id: "stu-5", name: "Sofia Petrov", level: "6ta", age: 11, gender: "Female", hand: "Right", racketType: "Wilson Roland Garros", since: new Date(2024, 0, 1) },
  { id: "stu-6", name: "Diego Alvarez", nickname: "Dee", level: "1ra", age: 19, gender: "Male", hand: "Left", racketType: "Babolat Pure Aero", since: new Date(2020, 7, 1), coachingNote: "Working on net approach timing." },
  { id: "stu-7", name: "Grace Kim", level: "4ta", age: 15, gender: "Female", hand: "Right", racketType: "Head Radical", since: new Date(2023, 3, 1) },
  { id: "stu-8", name: "Owen Fischer", nickname: "Ozzy", level: "6ta", age: 13, gender: "Male", hand: "Right", racketType: "Wilson Ultra 100", since: new Date(2024, 2, 1) },
]

function atTime(base: Date, hour: number, minute: number, dayOffset = 0): Date {
  const d = new Date(base)
  d.setDate(d.getDate() + dayOffset)
  d.setHours(hour, minute, 0, 0)
  return d
}

interface Seed {
  dayOffset: number
  hour: number
  minute: number
  durationMinutes: number
  studentIndex: number
  locationIndex: number
  type?: ClassType
}

const CLASS_TYPES: ClassType[] = ["Private", "Group", "Match"]

// Deterministically fills in classes for timeline days beyond the hand-authored
// seeds below (dayOffset -14..-1 and 10..14), so the Classes Timeline chart has
// real data at every offset its range slider can reach.
function buildFillerSeeds(dayOffsets: number[]): Seed[] {
  const hours = [8, 9, 10, 14, 15, 16, 17, 18]
  const durations: Array<45 | 60> = [45, 60]
  let cursor = 0
  const filler: Seed[] = []

  for (const dayOffset of dayOffsets) {
    const classesOnDay = (Math.abs(dayOffset) % 3) + 1
    for (let i = 0; i < classesOnDay; i++) {
      filler.push({
        dayOffset,
        hour: hours[cursor % hours.length],
        minute: cursor % 2 === 0 ? 0 : 30,
        durationMinutes: durations[cursor % durations.length],
        studentIndex: cursor % mockStudents.length,
        locationIndex: cursor % mockLocations.length,
        type: CLASS_TYPES[cursor % CLASS_TYPES.length],
      })
      cursor++
    }
  }

  return filler
}

function buildMockClasses(): ClassInstance[] {
  const now = new Date()
  const students = mockStudents
  const locations = mockLocations

  const seeds: Seed[] = [
    // earlier today (completed, since they're in the morning)
    { dayOffset: 0, hour: 8, minute: 0, durationMinutes: 60, studentIndex: 0, locationIndex: 0, type: "Private" },
    { dayOffset: 0, hour: 9, minute: 30, durationMinutes: 45, studentIndex: 1, locationIndex: 1, type: "Group" },
    // later today
    { dayOffset: 0, hour: 16, minute: 0, durationMinutes: 60, studentIndex: 2, locationIndex: 2, type: "Private" },
    { dayOffset: 0, hour: 18, minute: 0, durationMinutes: 60, studentIndex: 3, locationIndex: 0, type: "Match" },
    // this week
    { dayOffset: 1, hour: 9, minute: 0, durationMinutes: 60, studentIndex: 4, locationIndex: 1, type: "Private" },
    { dayOffset: 1, hour: 17, minute: 0, durationMinutes: 45, studentIndex: 5, locationIndex: 3, type: "Group" },
    { dayOffset: 2, hour: 10, minute: 0, durationMinutes: 60, studentIndex: 6, locationIndex: 2, type: "Private" },
    { dayOffset: 2, hour: 16, minute: 30, durationMinutes: 60, studentIndex: 7, locationIndex: 0, type: "Private" },
    { dayOffset: 3, hour: 8, minute: 30, durationMinutes: 60, studentIndex: 0, locationIndex: 1, type: "Match" },
    { dayOffset: 3, hour: 18, minute: 0, durationMinutes: 45, studentIndex: 1, locationIndex: 3, type: "Private" },
    { dayOffset: 4, hour: 15, minute: 0, durationMinutes: 60, studentIndex: 2, locationIndex: 0, type: "Group" },
    { dayOffset: 4, hour: 17, minute: 30, durationMinutes: 60, studentIndex: 3, locationIndex: 2, type: "Private" },
    { dayOffset: 5, hour: 9, minute: 0, durationMinutes: 60, studentIndex: 4, locationIndex: 1, type: "Private" },
    { dayOffset: 6, hour: 11, minute: 0, durationMinutes: 60, studentIndex: 5, locationIndex: 3, type: "Match" },
    // next week
    { dayOffset: 8, hour: 16, minute: 0, durationMinutes: 60, studentIndex: 6, locationIndex: 0, type: "Private" },
    { dayOffset: 9, hour: 9, minute: 30, durationMinutes: 45, studentIndex: 7, locationIndex: 2, type: "Group" },
    // filler so the Classes Timeline chart has data across its full ±14 day range
    // (day 7 was never hand-authored above, so it's included here too)
    ...buildFillerSeeds([
      -14, -13, -12, -11, -10, -9, -8, -7, -6, -5, -4, -3, -2, -1, 7, 10, 11, 12, 13, 14,
    ]),
  ]

  return seeds.map((seed, index) => {
    const startTime = atTime(now, seed.hour, seed.minute, seed.dayOffset)
    const endTime = new Date(startTime.getTime() + seed.durationMinutes * 60_000)
    return {
      id: `class-${index + 1}`,
      studentId: students[seed.studentIndex].id,
      locationId: locations[seed.locationIndex].id,
      type: seed.type ?? "Private",
      startTime,
      endTime,
      durationMinutes: seed.durationMinutes,
      completed: endTime.getTime() < now.getTime(),
    }
  })
}

export const mockClasses: ClassInstance[] = buildMockClasses()

export function getStudentById(id: string): Student | undefined {
  return mockStudents.find((student) => student.id === id)
}

export function getLocationById(id: string): Location | undefined {
  return mockLocations.find((location) => location.id === id)
}

export async function getStudents(): Promise<Student[]> {
  await delay(200)
  return mockStudents
}

export async function getLocations(): Promise<Location[]> {
  await delay(200)
  return mockLocations
}

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  )
}

export async function getClassesForToday(): Promise<ClassInstance[]> {
  await delay(200)
  const now = new Date()
  return mockClasses
    .filter((c) => isSameDay(c.startTime, now))
    .sort((a, b) => a.startTime.getTime() - b.startTime.getTime())
}

export async function getAllClasses(): Promise<ClassInstance[]> {
  await delay(200)
  return [...mockClasses].sort((a, b) => a.startTime.getTime() - b.startTime.getTime())
}

export async function getUpcomingClasses(days = 7): Promise<ClassInstance[]> {
  await delay(200)
  const now = new Date()
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const horizon = new Date(startOfToday.getTime() + days * 24 * 60 * 60_000)
  return mockClasses
    .filter((c) => c.startTime >= startOfToday && c.startTime < horizon)
    .sort((a, b) => a.startTime.getTime() - b.startTime.getTime())
}

export function getUpcomingClassesForStudent(
  classes: ClassInstance[],
  studentId: string,
  days = 30
): ClassInstance[] {
  const now = new Date()
  const horizon = new Date(now.getTime() + days * 24 * 60 * 60_000)
  return classes
    .filter((c) => c.studentId === studentId && c.startTime >= now && c.startTime < horizon)
    .sort((a, b) => a.startTime.getTime() - b.startTime.getTime())
}

export async function getNextClass(): Promise<ClassInstance | undefined> {
  await delay(200)
  const now = new Date()
  return mockClasses
    .filter((c) => c.startTime > now)
    .sort((a, b) => a.startTime.getTime() - b.startTime.getTime())[0]
}

export async function getHoursCoachedToday(): Promise<number> {
  await delay(200)
  const now = new Date()
  const minutes = mockClasses
    .filter((c) => isSameDay(c.startTime, now) && c.completed)
    .reduce((sum, c) => sum + c.durationMinutes, 0)
  return Math.round((minutes / 60) * 10) / 10
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

export async function getClassesCoachedThisWeek(): Promise<number> {
  await delay(200)
  const { start, end } = getCurrentWorkingWeekRange()
  return mockClasses.filter(
    (c) => c.completed && c.startTime >= start && c.startTime < end
  ).length
}

export async function getStudentsCoachedThisWeek(): Promise<number> {
  await delay(200)
  const { start, end } = getCurrentWorkingWeekRange()
  const studentIds = new Set(
    mockClasses
      .filter((c) => c.completed && c.startTime >= start && c.startTime < end)
      .map((c) => c.studentId)
  )
  return studentIds.size
}

const WEEKDAY_ABBREVIATIONS = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"]

export async function getBusiestDayThisWeek(): Promise<string | undefined> {
  await delay(200)
  const { start, end } = getCurrentWorkingWeekRange()
  const counts = [0, 0, 0, 0, 0, 0, 0]

  for (const c of mockClasses) {
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

export const STUDENT_LEVELS: StudentLevel[] = ["1ra", "2da", "3ra", "4ta", "5ta", "6ta"]

export interface LevelClassCount {
  level: StudentLevel
  count: number
}

export function getClassCountsByLevel(classes: ClassInstance[]): LevelClassCount[] {
  const counts: Record<StudentLevel, number> = {
    "1ra": 0,
    "2da": 0,
    "3ra": 0,
    "4ta": 0,
    "5ta": 0,
    "6ta": 0,
  }

  for (const c of classes) {
    const student = getStudentById(c.studentId)
    if (student) counts[student.level] += 1
  }

  return STUDENT_LEVELS.map((level) => ({ level, count: counts[level] }))
}

export interface DailyClassCount {
  dayOffset: number
  date: Date
  count: number
}

export async function getDailyClassCounts(maxDays: number): Promise<DailyClassCount[]> {
  await delay(200)
  const now = new Date()
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate())

  const results: DailyClassCount[] = []
  for (let offset = -maxDays; offset <= maxDays; offset++) {
    const date = new Date(startOfToday)
    date.setDate(date.getDate() + offset)
    const nextDate = new Date(date)
    nextDate.setDate(nextDate.getDate() + 1)

    const count = mockClasses.filter(
      (c) => c.startTime >= date && c.startTime < nextDate
    ).length

    results.push({ dayOffset: offset, date, count })
  }

  return results
}
