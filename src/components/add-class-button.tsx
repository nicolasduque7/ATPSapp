"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Plus } from "lucide-react"

import { Button } from "@/components/ui/button"
import { ClassEditDialog, createDraftEvent } from "@/components/calendar/class-edit-dialog"
import { createClass, createClassSeries } from "@/lib/actions/classes"
import type { CalendarClassEvent, ClassFormSubmission } from "@/components/calendar/types"
import type { Location, Student } from "@/lib/mock-data"

interface AddClassButtonProps {
  students: Student[]
  locations: Location[]
}

export function AddClassButton({ students, locations }: AddClassButtonProps) {
  const router = useRouter()
  const [creatingEvent, setCreatingEvent] = useState<CalendarClassEvent | null>(null)

  async function handleSave(submission: ClassFormSubmission) {
    if (submission.kind === "one-off") {
      await createClass(submission.input)
    } else if (submission.kind === "series-create") {
      await createClassSeries(submission.input)
    }
    router.refresh()
  }

  return (
    <>
      <Button
        type="button"
        variant="positive"
        onClick={() => setCreatingEvent(createDraftEvent())}
        disabled={students.length === 0 || locations.length === 0}
      >
        <Plus />
        Add new class
      </Button>

      <ClassEditDialog
        event={creatingEvent}
        mode="create"
        students={students}
        locations={locations}
        onOpenChange={(open) => {
          if (!open) setCreatingEvent(null)
        }}
        onSave={handleSave}
      />
    </>
  )
}
