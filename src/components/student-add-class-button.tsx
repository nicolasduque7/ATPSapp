"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Plus } from "lucide-react"
import { useTranslations } from "next-intl"

import { Button } from "@/components/ui/button"
import { StudentClassEditDialog } from "@/components/calendar/student-class-edit-dialog"
import { createDraftEvent } from "@/components/calendar/class-edit-dialog"
import { createStudentClass, createStudentClassSeries } from "@/lib/actions/student-classes"
import type { CalendarClassEvent, StudentClassFormSubmission } from "@/components/calendar/types"
import type { Coach, Location } from "@/lib/mock-data"
import type { AddableStudent } from "@/lib/queries/students"

interface StudentAddClassButtonProps {
  coaches: Coach[]
  locations: Location[]
  addableStudents: AddableStudent[]
}

export function StudentAddClassButton({ coaches, locations, addableStudents }: StudentAddClassButtonProps) {
  const t = useTranslations("calendar")
  const router = useRouter()
  const [creatingEvent, setCreatingEvent] = useState<CalendarClassEvent | null>(null)

  async function handleSave(submission: StudentClassFormSubmission) {
    if (submission.kind === "one-off") {
      const result = await createStudentClass(submission.input)
      if (!result.ok) throw new Error(result.error)
    } else if (submission.kind === "series-create") {
      const result = await createStudentClassSeries(submission.input)
      if (!result.ok) throw new Error(result.error)
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
        {t("bookClass")}
      </Button>

      <StudentClassEditDialog
        event={creatingEvent}
        mode="create"
        coaches={coaches}
        locations={locations}
        addableStudents={addableStudents}
        onOpenChange={(open) => {
          if (!open) setCreatingEvent(null)
        }}
        onSave={handleSave}
      />
    </>
  )
}
