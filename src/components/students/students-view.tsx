"use client"

import { useState } from "react"
import { Plus } from "lucide-react"

import { Button } from "@/components/ui/button"
import { LevelBadge } from "@/components/level-badge"
import { StudentProfileDialog } from "@/components/students/student-profile-dialog"
import { createStudent, deleteStudent, updateStudent, type StudentInput } from "@/lib/actions/students"
import { STUDENT_LEVELS, type ClassInstance, type Location, type Student } from "@/lib/mock-data"

interface StudentsViewProps {
  students: Student[]
  classes: ClassInstance[]
  locations: Location[]
}

const DRAFT_STUDENT: Student = {
  id: "draft",
  name: "",
  level: STUDENT_LEVELS[0],
  age: 10,
  gender: "Female",
  hand: "Right",
  since: new Date(),
  linked: false,
}

export function StudentsView({
  students: initialStudents,
  classes: initialClasses,
  locations,
}: StudentsViewProps) {
  const [students, setStudents] = useState(initialStudents)
  const [classes, setClasses] = useState(initialClasses)
  const [editingStudent, setEditingStudent] = useState<Student | null>(null)
  const [mode, setMode] = useState<"create" | "edit">("edit")

  function handleAddClick() {
    setMode("create")
    setEditingStudent(DRAFT_STUDENT)
  }

  function handleCardClick(student: Student) {
    setMode("edit")
    setEditingStudent(student)
  }

  async function handleSaveStudent(input: StudentInput) {
    if (mode === "create") {
      const created = await createStudent(input)
      setStudents((prev) => [...prev, created])
    } else if (editingStudent) {
      const saved = await updateStudent(editingStudent.id, input)
      setStudents((prev) => prev.map((student) => (student.id === saved.id ? saved : student)))
    }
  }

  async function handleDeleteStudent(studentId: string) {
    await deleteStudent(studentId)
    setStudents((prev) => prev.filter((student) => student.id !== studentId))
    setClasses((prev) => prev.filter((c) => c.studentId !== studentId))
    setEditingStudent(null)
  }

  function handleSaveClassInstance(saved: ClassInstance) {
    setClasses((prev) => prev.map((c) => (c.id === saved.id ? saved : c)))
  }

  function handleSaveClassSeries(seriesId: string, instances: ClassInstance[]) {
    setClasses((prev) => [...prev.filter((c) => c.seriesId !== seriesId), ...instances])
  }

  function handleInviteSent(studentId: string, email: string) {
    setStudents((prev) => prev.map((student) => (student.id === studentId ? { ...student, email } : student)))
  }

  function handleDeleteClass(target: { classId?: string; seriesId?: string }) {
    setClasses((prev) =>
      target.seriesId
        ? prev.filter((c) => c.seriesId !== target.seriesId)
        : prev.filter((c) => c.id !== target.classId)
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-2xl font-bold text-foreground">Students</h1>
          <p className="text-sm text-muted-foreground">Every student, shared across coaches.</p>
        </div>
        <Button
          type="button"
          variant="positive"
          size="icon"
          aria-label="Add student"
          onClick={handleAddClick}
        >
          <Plus />
        </Button>
      </div>

      {students.length === 0 ? (
        <div className="rounded-3xl bg-card p-6 text-sm text-muted-foreground">
          No students yet.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {students.map((student) => (
            <button
              key={student.id}
              type="button"
              onClick={() => handleCardClick(student)}
              className="flex cursor-pointer flex-col items-start gap-3 rounded-3xl bg-card p-6 text-left transition-colors duration-200 hover:bg-accent focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none motion-reduce:transition-none"
            >
              <div className="flex w-full items-center justify-between gap-2">
                <span className="font-heading text-base font-bold text-foreground">
                  {student.name}
                </span>
                <LevelBadge level={student.level} />
              </div>
              {student.nickname && (
                <span className="w-fit rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
                  {student.nickname}
                </span>
              )}
            </button>
          ))}
        </div>
      )}

      <StudentProfileDialog
        student={editingStudent}
        mode={mode}
        classes={classes}
        locations={locations}
        onOpenChange={(open) => {
          if (!open) setEditingStudent(null)
        }}
        onSave={handleSaveStudent}
        onDelete={handleDeleteStudent}
        onSaveClassInstance={handleSaveClassInstance}
        onSaveClassSeries={handleSaveClassSeries}
        onDeleteClass={handleDeleteClass}
        onInviteSent={handleInviteSent}
      />
    </div>
  )
}
