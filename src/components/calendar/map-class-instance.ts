import type { ClassInstance, Location, Student } from "@/lib/mock-data"
import type { CalendarClassEvent } from "@/components/calendar/types"

export function mapClassInstanceToEvent(
  instance: ClassInstance,
  students: Student[],
  locations: Location[]
): CalendarClassEvent | null {
  const student = students.find((s) => s.id === instance.studentId)
  const location = locations.find((l) => l.id === instance.locationId)
  if (!student || !location) return null

  return {
    id: instance.id,
    title: student.name,
    start: instance.startTime,
    end: instance.endTime,
    resource: {
      studentId: student.id,
      studentName: student.name,
      level: student.level,
      locationId: location.id,
      locationName: location.name,
      durationMinutes: instance.durationMinutes,
      type: instance.type,
      seriesId: instance.seriesId,
    },
  }
}
