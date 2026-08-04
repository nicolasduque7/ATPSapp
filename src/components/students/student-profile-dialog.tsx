"use client"

import { useId, useMemo, useState } from "react"
import { format } from "date-fns"
import { ChevronRight, RotateCcw, Trash2, UserX } from "lucide-react"
import { useTranslations } from "next-intl"

import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Slider } from "@/components/ui/slider"
import { Avatar } from "@/components/avatar"
import { NotifyDialog } from "@/components/notify-dialog"
import { LevelBadge } from "@/components/level-badge"
import { MonthYearPicker } from "@/components/month-year-picker"
import { ClassEditDialog } from "@/components/calendar/class-edit-dialog"
import type { CalendarClassEvent, ClassFormSubmission } from "@/components/calendar/types"
import { cn } from "@/lib/utils"
import { getLocationColorStyle } from "@/lib/location-colors"
import {
  updateClassInstance,
  updateClassSeries,
  deleteClassInstance,
  deleteClassSeries,
} from "@/lib/actions/classes"
import type { StudentInput } from "@/lib/actions/students"
import { inviteStudent } from "@/lib/actions/invites"
import {
  STUDENT_LEVELS,
  getUpcomingClassesForStudent,
  type ClassInstance,
  type Gender,
  type Hand,
  type Location,
  type Student,
  type StudentLevel,
} from "@/lib/mock-data"

interface StudentProfileDialogProps {
  student: Student | null
  mode: "create" | "edit"
  currentCoachId: string
  classes: ClassInstance[]
  locations: Location[]
  onOpenChange: (open: boolean) => void
  onSave: (input: StudentInput) => Promise<void>
  onDelete: (studentId: string) => Promise<void>
  onDeactivate: (studentId: string) => Promise<void>
  onReactivate: (studentId: string) => Promise<void>
  onSaveClassInstance: (classInstance: ClassInstance) => void
  onSaveClassSeries: (seriesId: string, instances: ClassInstance[]) => void
  onDeleteClass: (target: { classId?: string; seriesId?: string }) => void
  onInviteSent: (studentId: string, email: string) => void
}

const GENDER_OPTIONS: Gender[] = ["Female", "Male"]
const HAND_OPTIONS: Hand[] = ["Right", "Left"]

function formatClassTime(date: Date): string {
  const hours = date.getHours() % 12 || 12
  const minutes = date.getMinutes().toString().padStart(2, "0")
  return `${hours}:${minutes}`
}

function formatDuration(minutes: number): string {
  if (minutes % 60 === 0) return `${minutes / 60}h`
  if (minutes < 60) return `${minutes}m`
  return `${Math.floor(minutes / 60)}h ${minutes % 60}m`
}

export function StudentProfileDialog({
  student,
  mode,
  currentCoachId,
  classes,
  locations,
  onOpenChange,
  onSave,
  onDelete,
  onDeactivate,
  onReactivate,
  onSaveClassInstance,
  onSaveClassSeries,
  onDeleteClass,
  onInviteSent,
}: StudentProfileDialogProps) {
  const t = useTranslations("students")
  return (
    <Dialog open={!!student} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader className="sr-only">
          <DialogTitle>{mode === "create" ? t("addTitle") : t("editTitle")}</DialogTitle>
        </DialogHeader>

        {student && (
          <StudentProfileForm
            key={student.id}
            student={student}
            mode={mode}
            currentCoachId={currentCoachId}
            classes={classes}
            locations={locations}
            onOpenChange={onOpenChange}
            onSave={onSave}
            onDelete={onDelete}
            onDeactivate={onDeactivate}
            onReactivate={onReactivate}
            onSaveClassInstance={onSaveClassInstance}
            onSaveClassSeries={onSaveClassSeries}
            onDeleteClass={onDeleteClass}
            onInviteSent={onInviteSent}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}

interface StudentProfileFormProps {
  student: Student
  mode: "create" | "edit"
  currentCoachId: string
  classes: ClassInstance[]
  locations: Location[]
  onOpenChange: (open: boolean) => void
  onSave: (input: StudentInput) => Promise<void>
  onDelete: (studentId: string) => Promise<void>
  onDeactivate: (studentId: string) => Promise<void>
  onReactivate: (studentId: string) => Promise<void>
  onSaveClassInstance: (classInstance: ClassInstance) => void
  onSaveClassSeries: (seriesId: string, instances: ClassInstance[]) => void
  onDeleteClass: (target: { classId?: string; seriesId?: string }) => void
  onInviteSent: (studentId: string, email: string) => void
}

function StudentProfileForm({
  student,
  mode,
  currentCoachId,
  classes,
  locations,
  onOpenChange,
  onSave,
  onDelete,
  onDeactivate,
  onReactivate,
  onSaveClassInstance,
  onSaveClassSeries,
  onDeleteClass,
  onInviteSent,
}: StudentProfileFormProps) {
  const t = useTranslations("students")
  const tg = useTranslations("enums.gender")
  const th = useTranslations("enums.hand")
  const tl = useTranslations("enums.studentLevel")
  const te = useTranslations("enums.classType")
  const formId = useId()
  const [name, setName] = useState(student.name)
  const [nickname, setNickname] = useState(student.nickname ?? "")
  const [level, setLevel] = useState<StudentLevel>(student.level)
  const [age, setAge] = useState(student.age)
  const [gender, setGender] = useState<Gender>(student.gender)
  const [hand, setHand] = useState<Hand>(student.hand)
  const [racketType, setRacketType] = useState(student.racketType ?? "")
  const [since, setSince] = useState(student.since)
  const [coachingNote, setCoachingNote] = useState(student.coachingNote ?? "")
  const [forehandRating, setForehandRating] = useState(student.forehandRating)
  const [backhandRating, setBackhandRating] = useState(student.backhandRating)
  const [backhandSliceRating, setBackhandSliceRating] = useState(student.backhandSliceRating)
  const [volleyRating, setVolleyRating] = useState(student.volleyRating)
  const [serveRating, setServeRating] = useState(student.serveRating)
  const [dropShotRating, setDropShotRating] = useState(student.dropShotRating)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [statusError, setStatusError] = useState<string | null>(null)
  const [statusChanging, setStatusChanging] = useState(false)
  const [selectedClass, setSelectedClass] = useState<ClassInstance | null>(null)
  const [notifyOpen, setNotifyOpen] = useState(false)

  const upcoming = useMemo(
    () => getUpcomingClassesForStudent(classes, student.id),
    [classes, student.id]
  )

  const selectedEvent: CalendarClassEvent | null = useMemo(() => {
    if (!selectedClass) return null
    const location = locations.find((l) => l.id === selectedClass.locationId)
    if (!location) return null
    return {
      id: selectedClass.id,
      title: student.name,
      start: selectedClass.startTime,
      end: selectedClass.endTime,
      resource: {
        coachId: selectedClass.coachId,
        coachName: "",
        studentId: student.id,
        studentName: student.name,
        level,
        locationId: location.id,
        locationName: location.name,
        durationMinutes: selectedClass.durationMinutes,
        type: selectedClass.type,
        seriesId: selectedClass.seriesId,
        isOpen: selectedClass.isOpen,
        maxJoiners: selectedClass.maxJoiners,
        // This entry point only ever loads the one profile's own student
        // into ClassEditDialog's students prop (see `students={[student]}`
        // below), so other roster members' names can't be resolved here —
        // ids are preserved (a Group/Match roster survives being edited
        // from this dialog), just not rendered as chips from this entry
        // point.
        participantStudentIds: selectedClass.participantStudentIds,
        participantNames: [],
      },
    }
  }, [selectedClass, locations, student.id, student.name, level])

  async function handleSubmit(formEvent: React.FormEvent) {
    formEvent.preventDefault()

    if (!name.trim()) {
      setError(t("errorNameRequired"))
      return
    }

    setError(null)
    setSaving(true)
    try {
      await onSave({
        name: name.trim(),
        nickname: nickname.trim() || undefined,
        level,
        age,
        gender,
        hand,
        racketType: racketType.trim() || undefined,
        since,
        coachingNote: coachingNote.trim() || undefined,
        forehandRating,
        backhandRating,
        backhandSliceRating,
        volleyRating,
        serveRating,
        dropShotRating,
      })
      onOpenChange(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : t("errorGeneric"))
    } finally {
      setSaving(false)
    }
  }

  async function handleToggleStatus() {
    setStatusError(null)
    setStatusChanging(true)
    try {
      if (student.deactivatedAt) {
        await onReactivate(student.id)
      } else {
        await onDeactivate(student.id)
      }
    } catch (err) {
      setStatusError(err instanceof Error ? err.message : t("errorGeneric"))
      setStatusChanging(false)
    }
  }

  async function handleConfirmDeleteStudent() {
    setDeleteError(null)
    setDeleting(true)
    try {
      await onDelete(student.id)
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : t("errorDeleteGeneric"))
      setDeleting(false)
    }
  }

  async function handleSaveClass(submission: ClassFormSubmission) {
    switch (submission.kind) {
      case "instance-edit": {
        if (!selectedClass) return
        const result = await updateClassInstance(selectedClass.id, submission.input)
        if (!result.ok) throw new Error(result.error)
        onSaveClassInstance(result.data)
        break
      }
      case "series-edit": {
        const result = await updateClassSeries(submission.seriesId, submission.input)
        if (!result.ok) throw new Error(result.error)
        onSaveClassSeries(submission.seriesId, result.data)
        break
      }
      default:
        break
    }
    setSelectedClass(null)
    setNotifyOpen(true)
  }

  async function handleDeleteClass(classId: string, options?: { deleteSeries?: boolean }) {
    if (options?.deleteSeries && selectedClass?.seriesId) {
      const seriesId = selectedClass.seriesId
      const result = await deleteClassSeries(seriesId)
      if (!result.ok) throw new Error(result.error)
      onDeleteClass({ seriesId })
    } else {
      const result = await deleteClassInstance(classId)
      if (!result.ok) throw new Error(result.error)
      onDeleteClass({ classId })
    }
    setSelectedClass(null)
    setNotifyOpen(true)
  }

  return (
    <>
      <div className="mt-2 flex items-center gap-4">
        <Avatar name={name || student.name} className="size-16 text-lg" />
        <div className="flex flex-1 flex-col gap-1.5">
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            aria-label={t("nameLabel")}
            placeholder={t("namePlaceholder")}
            className="h-9 border-0 bg-transparent p-0 font-heading text-lg font-bold text-foreground focus-visible:ring-0"
          />
          <div className="flex items-center gap-2">
            <LevelBadge level={level} />
            <Input
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              aria-label={t("nicknameLabel")}
              placeholder={t("nicknamePlaceholder")}
              className="h-7 max-w-32 text-xs"
            />
          </div>
        </div>
      </div>

      <form id={formId} onSubmit={handleSubmit} className="mt-5 flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-muted-foreground">{t("level")}</span>
          <div role="radiogroup" aria-label={t("level")} className="flex flex-wrap gap-2">
            {STUDENT_LEVELS.map((l) => (
              <button
                key={l}
                type="button"
                role="radio"
                aria-checked={level === l}
                onClick={() => setLevel(l)}
                className={cn(
                  "cursor-pointer rounded-full border-2 px-3 py-1 text-sm font-medium transition-all duration-200 motion-reduce:transition-none",
                  level === l
                    ? "border-primary bg-primary/10 text-primary shadow-md shadow-primary/20"
                    : "border-transparent bg-muted text-muted-foreground hover:bg-accent"
                )}
              >
                {tl(l)}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <TileField label={t("age")}>
            <Input
              type="number"
              min={0}
              value={age}
              onChange={(e) => setAge(Math.max(0, Number(e.target.value)))}
              aria-label={t("age")}
              className="h-auto border-0 bg-transparent p-0 text-base font-bold text-foreground focus-visible:ring-0"
            />
          </TileField>
          <TileField label={t("gender")}>
            <Select value={gender} onValueChange={(value) => setGender(value as Gender)}>
              <SelectTrigger
                aria-label={t("gender")}
                className="h-auto border-0 bg-transparent p-0 text-base font-bold text-foreground"
              >
                <SelectValue>{(value: Gender) => tg(value)}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                {GENDER_OPTIONS.map((option) => (
                  <SelectItem key={option} value={option}>
                    {tg(option)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </TileField>
          <TileField label={t("hand")}>
            <Select value={hand} onValueChange={(value) => setHand(value as Hand)}>
              <SelectTrigger
                aria-label={t("hand")}
                className="h-auto border-0 bg-transparent p-0 text-base font-bold text-foreground"
              >
                <SelectValue>{(value: Hand) => th(value)}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                {HAND_OPTIONS.map((option) => (
                  <SelectItem key={option} value={option}>
                    {th(option)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </TileField>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <TileField label={t("racket")}>
            <Input
              value={racketType}
              onChange={(e) => setRacketType(e.target.value)}
              placeholder={t("racketPlaceholder")}
              aria-label={t("racket")}
              className="h-auto border-0 bg-transparent p-0 text-base font-bold text-foreground focus-visible:ring-0"
            />
          </TileField>
          <TileField label={t("since")}>
            <MonthYearPicker value={since} onChange={setSince} />
          </TileField>
        </div>

        <div className="flex flex-col gap-3 rounded-2xl bg-muted p-4">
          <span className="text-xs font-semibold tracking-wide text-primary uppercase">
            {t("strokeRatings")}
          </span>
          <RatingSlider label={t("forehand")} value={forehandRating} onChange={setForehandRating} />
          <RatingSlider label={t("backhand")} value={backhandRating} onChange={setBackhandRating} />
          <RatingSlider
            label={t("backhandSlice")}
            value={backhandSliceRating}
            onChange={setBackhandSliceRating}
          />
          <RatingSlider label={t("volley")} value={volleyRating} onChange={setVolleyRating} />
          <RatingSlider label={t("serve")} value={serveRating} onChange={setServeRating} />
          <RatingSlider label={t("dropShot")} value={dropShotRating} onChange={setDropShotRating} />
        </div>

        <div className="flex flex-col gap-1.5 rounded-2xl bg-muted p-4">
          <span className="text-xs font-semibold tracking-wide text-primary uppercase">
            {t("coachingNote")}
          </span>
          <textarea
            value={coachingNote}
            onChange={(e) => setCoachingNote(e.target.value)}
            rows={2}
            placeholder={t("coachingNotePlaceholder")}
            aria-label={t("coachingNote")}
            className="resize-none bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
          />
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}
      </form>

      <DialogFooter>
        <Button type="button" variant="secondary" onClick={() => onOpenChange(false)} disabled={saving}>
          {t("cancel")}
        </Button>
        <Button type="submit" form={formId} variant="positive" disabled={saving}>
          {saving ? t("saving") : t("save")}
        </Button>
      </DialogFooter>

      {mode === "edit" && (
        <div className="mt-4 flex flex-col gap-2 border-t border-border pt-4">
          <span className="text-xs font-medium text-muted-foreground">{t("studentLogin")}</span>
          {student.linked ? (
            <span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-positive/10 px-2.5 py-1 text-xs font-medium text-positive">
              {t("linked")}
            </span>
          ) : (
            <StudentInviteControl
              studentId={student.id}
              initialEmail={student.email ?? ""}
              onInviteSent={(email) => onInviteSent(student.id, email)}
            />
          )}
        </div>
      )}

      {mode === "edit" && (
        <div className="mt-4 flex flex-col gap-2 border-t border-border pt-4">
          {statusError && <p className="text-sm text-destructive">{statusError}</p>}
          <Button
            type="button"
            variant={student.deactivatedAt ? "secondary" : "outline"}
            className="w-full"
            onClick={handleToggleStatus}
            disabled={statusChanging}
          >
            {student.deactivatedAt ? <RotateCcw /> : <UserX />}
            {statusChanging
              ? student.deactivatedAt
                ? t("reactivating")
                : t("deactivating")
              : student.deactivatedAt
                ? t("reactivateStudent")
                : t("deactivateStudent")}
          </Button>
        </div>
      )}

      {mode === "edit" && (
        <div className="mt-4 flex flex-col gap-2 border-t border-border pt-4">
          {deleteError && <p className="text-sm text-destructive">{deleteError}</p>}
          {confirmingDelete ? (
            <div className="flex flex-col gap-2">
              <p className="text-sm text-foreground">{t("deleteConfirm", { name: student.name })}</p>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    setConfirmingDelete(false)
                    setDeleteError(null)
                  }}
                  disabled={deleting}
                >
                  {t("keepStudent")}
                </Button>
                <Button
                  type="button"
                  variant="destructive"
                  size="sm"
                  onClick={handleConfirmDeleteStudent}
                  disabled={deleting}
                >
                  {deleting ? t("deleting") : t("confirmDelete")}
                </Button>
              </div>
            </div>
          ) : (
            <Button
              type="button"
              variant="destructive"
              className="w-full"
              onClick={() => setConfirmingDelete(true)}
            >
              <Trash2 />
              {t("deleteStudent")}
            </Button>
          )}
        </div>
      )}

      <div className="mt-6 border-t border-border pt-5">
        <h3 className="font-heading text-base font-bold text-foreground">{t("upcomingClasses")}</h3>

        {upcoming.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">{t("noUpcomingClasses")}</p>
        ) : (
          <div className="mt-3 flex flex-col gap-2">
            {upcoming.map((classInstance) => {
              const location = locations.find((l) => l.id === classInstance.locationId)
              const style = location ? getLocationColorStyle(location.id, locations) : null
              return (
                <button
                  key={classInstance.id}
                  type="button"
                  onClick={() => setSelectedClass(classInstance)}
                  className="flex cursor-pointer items-center gap-3 rounded-2xl bg-muted p-3 text-left transition-colors duration-200 hover:bg-accent focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none motion-reduce:transition-none"
                >
                  <div className="flex w-12 shrink-0 flex-col items-center">
                    <span className="text-[0.65rem] font-medium text-muted-foreground uppercase">
                      {format(classInstance.startTime, "EEE")}
                    </span>
                    <span className="font-heading text-sm font-bold text-foreground">
                      {formatClassTime(classInstance.startTime)}
                    </span>
                  </div>
                  <div className="flex flex-1 flex-col gap-1">
                    <span className="text-sm text-foreground">
                      {te(classInstance.type)} · {formatDuration(classInstance.durationMinutes)}
                    </span>
                    {location && style && (
                      <span
                        className={cn(
                          "inline-flex w-fit items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium",
                          style.tint,
                          style.text
                        )}
                      >
                        <span className={cn("size-1.5 rounded-full", style.dot)} />
                        {location.name}
                      </span>
                    )}
                  </div>
                  <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
                </button>
              )
            })}
          </div>
        )}
      </div>

      <ClassEditDialog
        event={selectedEvent}
        mode="edit"
        currentCoachId={currentCoachId}
        students={[student]}
        locations={locations}
        onOpenChange={(open) => {
          if (!open) setSelectedClass(null)
        }}
        onSave={handleSaveClass}
        onDelete={handleDeleteClass}
      />

      <NotifyDialog open={notifyOpen} onOpenChange={setNotifyOpen} />
    </>
  )
}

function StudentInviteControl({
  studentId,
  initialEmail,
  onInviteSent,
}: {
  studentId: string
  initialEmail: string
  onInviteSent: (email: string) => void
}) {
  const t = useTranslations("students")
  const [email, setEmail] = useState(initialEmail)
  const [link, setLink] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [sending, setSending] = useState(false)
  const [copied, setCopied] = useState(false)

  async function handleInvite() {
    setError(null)
    setSending(true)
    setCopied(false)
    try {
      const inviteLink = await inviteStudent(studentId, email)
      setLink(inviteLink)
      onInviteSent(email)
    } catch (err) {
      setError(err instanceof Error ? err.message : t("errorInviteGeneric"))
    } finally {
      setSending(false)
    }
  }

  async function handleCopy() {
    if (!link) return
    await navigator.clipboard.writeText(link)
    setCopied(true)
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <Input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder={t("emailPlaceholder")}
          aria-label={t("studentEmail")}
          className="h-9"
        />
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={handleInvite}
          disabled={sending || !email.trim()}
        >
          {sending ? t("inviting") : t("invite")}
        </Button>
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      {link && (
        <div className="flex items-center gap-2 rounded-2xl bg-muted p-3">
          <span className="flex-1 truncate text-xs text-muted-foreground">{link}</span>
          <Button type="button" variant="outline" size="sm" onClick={handleCopy}>
            {copied ? t("copied") : t("copy")}
          </Button>
        </div>
      )}
    </div>
  )
}

function TileField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1 rounded-2xl bg-muted p-3">
      <span className="text-[0.65rem] font-medium tracking-wide text-muted-foreground uppercase">
        {label}
      </span>
      {children}
    </div>
  )
}

function RatingSlider({
  label,
  value,
  onChange,
}: {
  label: string
  value: number
  onChange: (value: number) => void
}) {
  return (
    <div className="flex items-center gap-3">
      <span className="w-28 shrink-0 text-sm text-foreground">{label}</span>
      <Slider
        value={[value]}
        onValueChange={(next) => onChange(Array.isArray(next) ? next[0] : next)}
        min={0}
        max={100}
        step={1}
        className="flex-1"
        aria-label={label}
      />
      <span className="w-8 shrink-0 text-right text-sm font-medium text-foreground">{value}</span>
    </div>
  )
}
