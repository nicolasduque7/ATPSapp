import type { Coach, ClassInstance, Location, StudentLevel } from "@/lib/mock-data"
import type { CalendarClassEvent } from "@/components/calendar/types"

// Deliberately narrower than the full Student type — this only ever reads
// id/name/level, so a student caller can pass a mix of their own full
// profile and the lighter AddableStudent shape (from get_addable_students,
// which can't return a peer's full row) without a cast.
export interface NameableStudent {
  id: string
  name: string
  level: StudentLevel
}

export function mapClassInstanceToEvent(
  instance: ClassInstance,
  students: NameableStudent[],
  locations: Location[],
  coaches: Coach[] = []
): CalendarClassEvent | null {
  const student = students.find((s) => s.id === instance.studentId)
  const location = locations.find((l) => l.id === instance.locationId)
  if (!student || !location) return null
  const coachName = coaches.find((c) => c.id === instance.coachId)?.name ?? "Coach"
  const participantNames = instance.participantStudentIds
    .map((id) => students.find((s) => s.id === id)?.name)
    .filter((name): name is string => !!name)

  return {
    id: instance.id,
    title: student.name,
    start: instance.startTime,
    end: instance.endTime,
    resource: {
      coachId: instance.coachId,
      coachName,
      studentId: student.id,
      studentName: student.name,
      level: student.level,
      locationId: location.id,
      locationName: location.name,
      durationMinutes: instance.durationMinutes,
      type: instance.type,
      seriesId: instance.seriesId,
      isOpen: instance.isOpen,
      maxJoiners: instance.maxJoiners,
      participantStudentIds: instance.participantStudentIds,
      participantNames,
    },
  }
}
