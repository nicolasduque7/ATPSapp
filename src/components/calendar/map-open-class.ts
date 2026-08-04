import type { Location } from "@/lib/mock-data"
import type { OpenClassForStudent } from "@/lib/queries/classes"
import type { CalendarClassEvent } from "@/components/calendar/types"

// Mirrors mapClassInstanceToEvent's shape, but sources the host student's
// name/level from the RPC result (getOpenClassesForStudent) rather than a
// local students[] lookup — a browsing student never has that student's row
// available client-side. seriesId is always null here: whether the
// underlying instance happens to belong to a series is irrelevant to a
// read-only preview (Open Class is a per-instance flag, not a series one).
export function mapOpenClassToEvent(
  openClass: OpenClassForStudent,
  locations: Location[]
): CalendarClassEvent | null {
  const location = locations.find((l) => l.id === openClass.locationId)
  if (!location) return null

  return {
    id: openClass.classId,
    title: openClass.hostStudentName,
    start: openClass.startTime,
    end: openClass.endTime,
    resource: {
      coachId: openClass.coachId,
      coachName: openClass.coachName,
      studentId: openClass.hostStudentId,
      studentName: openClass.hostStudentName,
      level: openClass.hostStudentLevel,
      locationId: location.id,
      locationName: location.name,
      durationMinutes: openClass.durationMinutes,
      type: openClass.type,
      seriesId: null,
      isOpen: true,
      maxJoiners: openClass.maxJoiners,
      // A browsing student's read-only Open Class preview never shows the
      // roster today — get_open_classes_for_student doesn't return it, and
      // this event only ever opens the request-to-join popup, not the
      // roster-bearing edit dialog.
      participantStudentIds: [],
      participantNames: [],
    },
  }
}
