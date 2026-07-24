export type StudentLevel = "1ra" | "2da" | "3ra" | "4ta" | "5ta" | "6ta"

export type ClassType = "Private" | "Group" | "Match"

export type Gender = "Female" | "Male"

export type Hand = "Right" | "Left"

export interface Coach {
  id: string
  name: string
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
  email?: string
  linked: boolean
}

export interface ClassInstance {
  id: string
  coachId: string
  studentId: string
  locationId: string
  seriesId?: string | null
  type: ClassType
  startTime: Date
  endTime: Date
  durationMinutes: number
  completed: boolean
  notes?: string
}

export interface AvailabilityBlock {
  id: string
  coachId: string
  seriesId?: string | null
  locationIds: string[]
  startTime: Date
  endTime: Date
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

export const STUDENT_LEVELS: StudentLevel[] = ["1ra", "2da", "3ra", "4ta", "5ta", "6ta"]

export interface LevelClassCount {
  level: StudentLevel
  count: number
}

export interface DailyClassCount {
  dayOffset: number
  date: Date
  count: number
}
