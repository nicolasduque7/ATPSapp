"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Plus } from "lucide-react"

import { Button } from "@/components/ui/button"
import { StudentClassEditDialog } from "@/components/calendar/student-class-edit-dialog"
import { createDraftEvent } from "@/components/calendar/class-edit-dialog"
import { createStudentClass, createStudentClassSeries } from "@/lib/actions/student-classes"
import type { CalendarClassEvent, StudentClassFormSubmission } from "@/components/calendar/types"
import type { Coach, Location } from "@/lib/mock-data"

interface StudentAddClassButtonProps {
  coaches: Coach[]
  locations: Location[]
}

export function StudentAddClassButton({ coaches, locations }: StudentAddClassButtonProps) {
  const router = useRouter()
  const [creatingEvent, setCreatingEvent] = useState<CalendarClassEvent | null>(null)

  async function handleSave(submission: StudentClassFormSubmission) {
    if (submission.kind === "one-off") {
      await createStudentClass(submission.input)
    } else if (submission.kind === "series-create") {
      await createStudentClassSeries(submission.input)
    }
    router.refresh()
  }

  return (
    <>
      <Button
        type="button"
        variant="positive"
        onClick={() => setCreatingEvent(createDraftEvent())}
        disabled={coaches.length === 0 || locations.length === 0}
      >
        <Plus />
        Book a class
      </Button>

      <StudentClassEditDialog
        event={creatingEvent}
        mode="create"
        coaches={coaches}
        locations={locations}
        onOpenChange={(open) => {
          if (!open) setCreatingEvent(null)
        }}
        onSave={handleSave}
      />
    </>
  )
}
