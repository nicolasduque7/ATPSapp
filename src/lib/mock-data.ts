export type StudentLevel = "Beginner" | "Intermediate" | "Advanced"

export interface Coach {
  id: string
  name: string
  email: string
}

export interface Location {
  id: string
  name: string
  address?: string
}

export interface Student {
  id: string
  name: string
  nickname?: string
  level: StudentLevel
  age: number
  gender: string
  racketType?: string
}

export interface ClassInstance {
  id: string
  studentId: string
  locationId: string
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
  { id: "loc-1", name: "Riverside Courts", address: "100 Riverside Dr" },
  { id: "loc-2", name: "Westside Park", address: "220 Westside Ave" },
  { id: "loc-3", name: "Oakwood Tennis Club", address: "44 Oakwood Ln" },
  { id: "loc-4", name: "Downtown Rec Center", address: "12 Main St" },
]

export const mockStudents: Student[] = [
  { id: "stu-1", name: "Ana Reyes", nickname: "Ani", level: "Intermediate", age: 14, gender: "Female", racketType: "Wilson Clash 100" },
  { id: "stu-2", name: "Leo Martins", nickname: "Leo", level: "Beginner", age: 9, gender: "Male", racketType: "Babolat Pure Drive Jr" },
  { id: "stu-3", name: "Priya Nair", level: "Advanced", age: 17, gender: "Female", racketType: "Head Speed Pro" },
  { id: "stu-4", name: "Marcus Chen", nickname: "Marc", level: "Intermediate", age: 22, gender: "Male", racketType: "Yonex Ezone 98" },
  { id: "stu-5", name: "Sofia Petrov", level: "Beginner", age: 11, gender: "Female", racketType: "Wilson Roland Garros" },
  { id: "stu-6", name: "Diego Alvarez", nickname: "Dee", level: "Advanced", age: 19, gender: "Male", racketType: "Babolat Pure Aero" },
  { id: "stu-7", name: "Grace Kim", level: "Intermediate", age: 15, gender: "Female", racketType: "Head Radical" },
  { id: "stu-8", name: "Owen Fischer", nickname: "Ozzy", level: "Beginner", age: 13, gender: "Male", racketType: "Wilson Ultra 100" },
]

function atTime(base: Date, hour: number, minute: number, dayOffset = 0): Date {
  const d = new Date(base)
  d.setDate(d.getDate() + dayOffset)
  d.setHours(hour, minute, 0, 0)
  return d
}

function buildMockClasses(): ClassInstance[] {
  const now = new Date()
  const students = mockStudents
  const locations = mockLocations

  interface Seed {
    dayOffset: number
    hour: number
    minute: number
    durationMinutes: number
    studentIndex: number
    locationIndex: number
  }

  const seeds: Seed[] = [
    // earlier today (completed, since they're in the morning)
    { dayOffset: 0, hour: 8, minute: 0, durationMinutes: 60, studentIndex: 0, locationIndex: 0 },
    { dayOffset: 0, hour: 9, minute: 30, durationMinutes: 45, studentIndex: 1, locationIndex: 1 },
    // later today
    { dayOffset: 0, hour: 16, minute: 0, durationMinutes: 60, studentIndex: 2, locationIndex: 2 },
    { dayOffset: 0, hour: 18, minute: 0, durationMinutes: 60, studentIndex: 3, locationIndex: 0 },
    // this week
    { dayOffset: 1, hour: 9, minute: 0, durationMinutes: 60, studentIndex: 4, locationIndex: 1 },
    { dayOffset: 1, hour: 17, minute: 0, durationMinutes: 45, studentIndex: 5, locationIndex: 3 },
    { dayOffset: 2, hour: 10, minute: 0, durationMinutes: 60, studentIndex: 6, locationIndex: 2 },
    { dayOffset: 2, hour: 16, minute: 30, durationMinutes: 60, studentIndex: 7, locationIndex: 0 },
    { dayOffset: 3, hour: 8, minute: 30, durationMinutes: 60, studentIndex: 0, locationIndex: 1 },
    { dayOffset: 3, hour: 18, minute: 0, durationMinutes: 45, studentIndex: 1, locationIndex: 3 },
    { dayOffset: 4, hour: 15, minute: 0, durationMinutes: 60, studentIndex: 2, locationIndex: 0 },
    { dayOffset: 4, hour: 17, minute: 30, durationMinutes: 60, studentIndex: 3, locationIndex: 2 },
    { dayOffset: 5, hour: 9, minute: 0, durationMinutes: 60, studentIndex: 4, locationIndex: 1 },
    { dayOffset: 6, hour: 11, minute: 0, durationMinutes: 60, studentIndex: 5, locationIndex: 3 },
    // next week
    { dayOffset: 8, hour: 16, minute: 0, durationMinutes: 60, studentIndex: 6, locationIndex: 0 },
    { dayOffset: 9, hour: 9, minute: 30, durationMinutes: 45, studentIndex: 7, locationIndex: 2 },
  ]

  return seeds.map((seed, index) => {
    const startTime = atTime(now, seed.hour, seed.minute, seed.dayOffset)
    const endTime = new Date(startTime.getTime() + seed.durationMinutes * 60_000)
    return {
      id: `class-${index + 1}`,
      studentId: students[seed.studentIndex].id,
      locationId: locations[seed.locationIndex].id,
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

export async function getUpcomingClasses(days = 7): Promise<ClassInstance[]> {
  await delay(200)
  const now = new Date()
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const horizon = new Date(startOfToday.getTime() + days * 24 * 60 * 60_000)
  return mockClasses
    .filter((c) => c.startTime >= startOfToday && c.startTime < horizon)
    .sort((a, b) => a.startTime.getTime() - b.startTime.getTime())
}

export async function getNextClass(): Promise<ClassInstance | undefined> {
  await delay(200)
  const now = new Date()
  return mockClasses
    .filter((c) => c.startTime > now)
    .sort((a, b) => a.startTime.getTime() - b.startTime.getTime())[0]
}

export async function getThisWeeksUpcomingClasses(): Promise<ClassInstance[]> {
  await delay(200)
  const now = new Date()
  const dayOfWeek = now.getDay()
  const startOfWeek = new Date(now.getFullYear(), now.getMonth(), now.getDate() - dayOfWeek)
  const endOfWeek = new Date(startOfWeek.getTime() + 7 * 24 * 60 * 60_000)
  return mockClasses
    .filter((c) => c.startTime > now && c.startTime < endOfWeek)
    .sort((a, b) => a.startTime.getTime() - b.startTime.getTime())
}

export async function getWeeklyHoursCoached(): Promise<number> {
  await delay(200)
  const now = new Date()
  const dayOfWeek = now.getDay()
  const startOfWeek = new Date(now.getFullYear(), now.getMonth(), now.getDate() - dayOfWeek)
  const endOfWeek = new Date(startOfWeek.getTime() + 7 * 24 * 60 * 60_000)
  const minutes = mockClasses
    .filter((c) => c.startTime >= startOfWeek && c.startTime < endOfWeek)
    .reduce((sum, c) => sum + c.durationMinutes, 0)
  return Math.round((minutes / 60) * 10) / 10
}
