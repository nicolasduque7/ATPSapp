"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Plus } from "lucide-react"
import { useTranslations } from "next-intl"

import { Button } from "@/components/ui/button"
import { ClassEditDialog, createDraftEvent } from "@/components/calendar/class-edit-dialog"
import { createClass, createClassSeries } from "@/lib/actions/classes"
import type { CalendarClassEvent, ClassFormSubmission } from "@/components/calendar/types"
import type { Location, Student } from "@/lib/mock-data"

interface AddClassButtonProps {
  coachId: string
  students: Student[]
  locations: Location[]
}

export function AddClassButton({ coachId, students, locations }: AddClassButtonProps) {
  const t = useTranslations("home")
  const router = useRouter()
  const [creatingEvent, setCreatingEvent] = useState<CalendarClassEvent | null>(null)

  async function handleSave(submission: ClassFormSubmission) {
    if (submission.kind === "one-off") {
      const result = await createClass(submission.input)
      if (!result.ok) throw new Error(result.error)
    } else if (submission.kind === "series-create") {
      const result = await createClassSeries(submission.input)
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
        disabled={students.length === 0 || locations.length === 0}
      >
        <Plus />
        {t("addNewClass")}
      </Button>

      <ClassEditDialog
        event={creatingEvent}
        mode="create"
        currentCoachId={coachId}
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
