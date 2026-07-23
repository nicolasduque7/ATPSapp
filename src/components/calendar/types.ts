import type { ClassType, StudentLevel } from "@/lib/mock-data"

export type CalendarViewKey = "month" | "week" | "three-day" | "day"

export interface CalendarClassEvent {
  id: string
  title: string
  start: Date
  end: Date
  resource: {
    studentId: string
    studentName: string
    level: StudentLevel
    locationId: string
    locationName: string
    durationMinutes: number
    type: ClassType
    seriesId?: string | null
  }
}
