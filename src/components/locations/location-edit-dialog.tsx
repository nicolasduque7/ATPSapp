"use client"

import { useId, useState } from "react"
import { RotateCcw, Trash2, XCircle } from "lucide-react"
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
import { cn } from "@/lib/utils"
import { getSurfaceColorStyle } from "@/lib/surface-colors"
import type { LocationInput } from "@/lib/actions/locations"
import type { CourtSurface, Location } from "@/lib/mock-data"

interface LocationEditDialogProps {
  location: Location | null
  mode: "create" | "edit"
  onOpenChange: (open: boolean) => void
  onSave: (input: LocationInput) => Promise<void>
  onDelete: (locationId: string) => Promise<void>
  onDeactivate: (locationId: string) => Promise<void>
  onReactivate: (locationId: string) => Promise<void>
}

const SURFACE_OPTIONS: CourtSurface[] = ["Hard", "Clay", "Both"]

export function LocationEditDialog({
  location,
  mode,
  onOpenChange,
  onSave,
  onDelete,
  onDeactivate,
  onReactivate,
}: LocationEditDialogProps) {
  const t = useTranslations("locations")
  return (
    <Dialog open={!!location} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{mode === "create" ? t("addTitle") : t("editTitle")}</DialogTitle>
        </DialogHeader>

        {location && (
          <LocationEditForm
            key={location.id}
            location={location}
            mode={mode}
            onOpenChange={onOpenChange}
            onSave={onSave}
            onDelete={onDelete}
            onDeactivate={onDeactivate}
            onReactivate={onReactivate}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}

interface LocationEditFormProps {
  location: Location
  mode: "create" | "edit"
  onOpenChange: (open: boolean) => void
  onSave: (input: LocationInput) => Promise<void>
  onDelete: (locationId: string) => Promise<void>
  onDeactivate: (locationId: string) => Promise<void>
  onReactivate: (locationId: string) => Promise<void>
}

function LocationEditForm({
  location,
  mode,
  onOpenChange,
  onSave,
  onDelete,
  onDeactivate,
  onReactivate,
}: LocationEditFormProps) {
  const t = useTranslations("locations")
  const ts = useTranslations("enums.courtSurface")
  const formId = useId()
  const [name, setName] = useState(location.name)
  const [address, setAddress] = useState(location.address ?? "")
  const [surface, setSurface] = useState<CourtSurface>(location.surface)
  const [hardCourts, setHardCourts] = useState(location.hardCourts)
  const [clayCourts, setClayCourts] = useState(location.clayCourts)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [statusError, setStatusError] = useState<string | null>(null)
  const [statusChanging, setStatusChanging] = useState(false)

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
        address: address.trim() || undefined,
        surface,
        hardCourts: surface === "Clay" ? 0 : hardCourts,
        clayCourts: surface === "Hard" ? 0 : clayCourts,
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
      if (location.deactivatedAt) {
        await onReactivate(location.id)
      } else {
        await onDeactivate(location.id)
      }
    } catch (err) {
      setStatusError(err instanceof Error ? err.message : t("errorGeneric"))
      setStatusChanging(false)
    }
  }

  async function handleConfirmDelete() {
    setDeleteError(null)
    setDeleting(true)
    try {
      await onDelete(location.id)
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : t("errorDeleteGeneric"))
      setDeleting(false)
    }
  }

  return (
    <>
      <form id={formId} onSubmit={handleSubmit} className="mt-4 flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <label htmlFor={`${formId}-name`} className="text-xs font-medium text-muted-foreground">
            {t("name")}
          </label>
          <Input
            id={`${formId}-name`}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t("namePlaceholder")}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor={`${formId}-address`} className="text-xs font-medium text-muted-foreground">
            {t("address")}
          </label>
          <Input
            id={`${formId}-address`}
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder={t("addressPlaceholder")}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-muted-foreground">{t("surface")}</span>
          <div role="radiogroup" aria-label={t("surface")} className="flex flex-wrap gap-2">
            {SURFACE_OPTIONS.map((option) => {
              const selected = option === surface
              const dots =
                option === "Both" ? (
                  <span className="flex items-center -space-x-1">
                    <span className={cn("size-2 rounded-full ring-2", getSurfaceColorStyle("Hard").dot, selected ? "ring-transparent" : "ring-muted")} />
                    <span className={cn("size-2 rounded-full ring-2", getSurfaceColorStyle("Clay").dot, selected ? "ring-transparent" : "ring-muted")} />
                  </span>
                ) : (
                  <span className={cn("size-2 shrink-0 rounded-full", getSurfaceColorStyle(option).dot)} />
                )
              return (
                <button
                  key={option}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  onClick={() => setSurface(option)}
                  className={cn(
                    "inline-flex cursor-pointer items-center gap-2 rounded-full border-2 px-3 py-1.5 text-sm font-medium transition-all duration-200 motion-reduce:transition-none",
                    selected
                      ? "border-primary bg-primary/10 text-primary shadow-md shadow-primary/20"
                      : "border-transparent bg-muted text-muted-foreground hover:bg-accent"
                  )}
                >
                  {dots}
                  {ts(option)}
                </button>
              )
            })}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          {surface !== "Clay" && (
            <div className="flex flex-col gap-1.5">
              <label htmlFor={`${formId}-hard`} className="text-xs font-medium text-muted-foreground">
                {t("hardCourts")}
              </label>
              <Input
                id={`${formId}-hard`}
                type="number"
                min={0}
                value={hardCourts}
                onChange={(e) => setHardCourts(Math.max(0, Number(e.target.value)))}
              />
            </div>
          )}
          {surface !== "Hard" && (
            <div className="flex flex-col gap-1.5">
              <label htmlFor={`${formId}-clay`} className="text-xs font-medium text-muted-foreground">
                {t("clayCourts")}
              </label>
              <Input
                id={`${formId}-clay`}
                type="number"
                min={0}
                value={clayCourts}
                onChange={(e) => setClayCourts(Math.max(0, Number(e.target.value)))}
              />
            </div>
          )}
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
          {statusError && <p className="text-sm text-destructive">{statusError}</p>}
          <Button
            type="button"
            variant={location.deactivatedAt ? "secondary" : "outline"}
            className="w-full"
            onClick={handleToggleStatus}
            disabled={statusChanging}
          >
            {location.deactivatedAt ? <RotateCcw /> : <XCircle />}
            {statusChanging
              ? location.deactivatedAt
                ? t("reactivating")
                : t("deactivating")
              : location.deactivatedAt
                ? t("reactivateLocation")
                : t("deactivateLocation")}
          </Button>
        </div>
      )}

      {mode === "edit" && (
        <div className="mt-4 flex flex-col gap-2 border-t border-border pt-4">
          {deleteError && <p className="text-sm text-destructive">{deleteError}</p>}
          {confirmingDelete ? (
            <div className="flex items-center gap-2">
              <p className="flex-1 text-sm text-foreground">{t("deleteLocationQuestion")}</p>
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
                {t("keepLocation")}
              </Button>
              <Button
                type="button"
                variant="destructive"
                size="sm"
                onClick={handleConfirmDelete}
                disabled={deleting}
              >
                {deleting ? t("deleting") : t("confirmDelete")}
              </Button>
            </div>
          ) : (
            <Button
              type="button"
              variant="destructive"
              className="w-full"
              onClick={() => setConfirmingDelete(true)}
            >
              <Trash2 />
              {t("deleteLocation")}
            </Button>
          )}
        </div>
      )}
    </>
  )
}
