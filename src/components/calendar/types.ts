import type { ClassInstanceInput, ClassSeriesInput, ClassSeriesUpdateInput } from "@/lib/actions/classes"
import type {
  StudentClassInstanceInput,
  StudentClassSeriesInput,
  StudentClassSeriesUpdateInput,
} from "@/lib/actions/student-classes"
import type {
  AvailabilityBlockInput,
  AvailabilitySeriesInput,
  AvailabilitySeriesUpdateInput,
} from "@/lib/actions/availability"
import type { AvailabilityBlock, ClassType, StudentLevel } from "@/lib/mock-data"
import type { AvailabilitySeriesSummary } from "@/lib/queries/availability"

export type CalendarViewKey = "month" | "week" | "three-day" | "day"

// What ClassEditDialog reports back to whoever renders it — the parent owns
// deciding which server action to call and how to reconcile its own event
// list, so the dialog doesn't need to know about Supabase at all.
export type ClassFormSubmission =
  | { kind: "one-off"; input: ClassInstanceInput }
  | { kind: "series-create"; input: ClassSeriesInput }
  | { kind: "instance-edit"; input: ClassInstanceInput }
  | { kind: "series-edit"; seriesId: string; input: ClassSeriesUpdateInput }

// Mirrors ClassFormSubmission for the student-facing dialog — the student
// picks a coach instead of a student, so the input shapes carry `coachId`
// instead of `studentId` (see StudentClassInstanceInput and friends).
export type StudentClassFormSubmission =
  | { kind: "one-off"; input: StudentClassInstanceInput }
  | { kind: "series-create"; input: StudentClassSeriesInput }
  | { kind: "instance-edit"; input: StudentClassInstanceInput }
  | { kind: "series-edit"; seriesId: string; input: StudentClassSeriesUpdateInput }

export interface CalendarClassEvent {
  id: string
  title: string
  start: Date
  end: Date
  resource: {
    coachId: string
    coachName: string
    studentId: string
    studentName: string
    level: StudentLevel
    locationId: string
    locationName: string
    durationMinutes: number
    type: ClassType
    seriesId?: string | null
    isOpen: boolean
    maxJoiners: number | null
    // Everyone besides the host (studentId/studentName above). Names are
    // resolved client-side by whoever builds the event (see
    // mapClassInstanceToEvent) — a parallel array to participantStudentIds,
    // skipping any id that couldn't be resolved from the caller's own
    // students list.
    participantStudentIds: string[]
    participantNames: string[]
  }
}

export interface CalendarAvailabilityEvent {
  id: string
  title: string
  start: Date
  end: Date
  resource: {
    coachId: string
    coachName: string
    locationIds: string[]
    locationNames: string[]
    seriesId?: string | null
  }
}

export type CalendarEvent =
  | ({ kind: "class" } & CalendarClassEvent)
  | ({ kind: "availability" } & CalendarAvailabilityEvent)

// What AvailabilityEditDialog reports back to whoever renders it — mirrors
// ClassFormSubmission's shape.
export type AvailabilityFormSubmission =
  | { kind: "one-off-create"; input: AvailabilityBlockInput }
  | { kind: "series-create"; input: AvailabilitySeriesInput }
  | { kind: "one-off-edit"; input: AvailabilityBlockInput }
  | { kind: "series-edit"; seriesId: string; input: AvailabilitySeriesUpdateInput }

// "block" covers both a genuine one-off block AND a single materialized
// occurrence of a recurring series (the dialog itself offers an
// instance-vs-series scope toggle when the block carries a seriesId).
// "series" is used by the Settings page, which lists — and edits — whole
// recurring rules directly rather than per-occurrence.
export type AvailabilityDialogTarget =
  | { kind: "create" }
  | { kind: "block"; block: AvailabilityBlock }
  | { kind: "series"; series: AvailabilitySeriesSummary }
