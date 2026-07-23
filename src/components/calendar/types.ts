import type { ClassInstanceInput, ClassSeriesInput, ClassSeriesUpdateInput } from "@/lib/actions/classes"
import type { ClassType, StudentLevel } from "@/lib/mock-data"

export type CalendarViewKey = "month" | "week" | "three-day" | "day"

// What ClassEditDialog reports back to whoever renders it — the parent owns
// deciding which server action to call and how to reconcile its own event
// list, so the dialog doesn't need to know about Supabase at all.
export type ClassFormSubmission =
  | { kind: "one-off"; input: ClassInstanceInput }
  | { kind: "series-create"; input: ClassSeriesInput }
  | { kind: "instance-edit"; input: ClassInstanceInput }
  | { kind: "series-edit"; seriesId: string; input: ClassSeriesUpdateInput }

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
