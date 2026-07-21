"use client"

import { useId, useState } from "react"
import { Trash2 } from "lucide-react"

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
import type { CourtSurface, Location } from "@/lib/mock-data"

interface LocationEditDialogProps {
  location: Location | null
  mode: "create" | "edit"
  onOpenChange: (open: boolean) => void
  onSave: (location: Location) => void
  onDelete: (locationId: string) => void
}

const SURFACE_OPTIONS: CourtSurface[] = ["Hard", "Clay", "Both"]

export function LocationEditDialog({
  location,
  mode,
  onOpenChange,
  onSave,
  onDelete,
}: LocationEditDialogProps) {
  return (
    <Dialog open={!!location} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{mode === "create" ? "Add location" : "Edit location"}</DialogTitle>
        </DialogHeader>

        {location && (
          <LocationEditForm
            key={location.id}
            location={location}
            mode={mode}
            onOpenChange={onOpenChange}
            onSave={onSave}
            onDelete={onDelete}
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
  onSave: (location: Location) => void
  onDelete: (locationId: string) => void
}

function LocationEditForm({ location, mode, onOpenChange, onSave, onDelete }: LocationEditFormProps) {
  const formId = useId()
  const [name, setName] = useState(location.name)
  const [address, setAddress] = useState(location.address ?? "")
  const [surface, setSurface] = useState<CourtSurface>(location.surface)
  const [hardCourts, setHardCourts] = useState(location.hardCourts)
  const [clayCourts, setClayCourts] = useState(location.clayCourts)
  const [error, setError] = useState<string | null>(null)
  const [confirmingDelete, setConfirmingDelete] = useState(false)

  function handleSubmit(formEvent: React.FormEvent) {
    formEvent.preventDefault()

    if (!name.trim()) {
      setError("Name is required.")
      return
    }

    onSave({
      ...location,
      name: name.trim(),
      address: address.trim() || undefined,
      surface,
      hardCourts: surface === "Clay" ? 0 : hardCourts,
      clayCourts: surface === "Hard" ? 0 : clayCourts,
    })
    onOpenChange(false)
  }

  return (
    <>
      <form id={formId} onSubmit={handleSubmit} className="mt-4 flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <label htmlFor={`${formId}-name`} className="text-xs font-medium text-muted-foreground">
            Name
          </label>
          <Input
            id={`${formId}-name`}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Riverside Courts"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor={`${formId}-address`} className="text-xs font-medium text-muted-foreground">
            Address
          </label>
          <Input
            id={`${formId}-address`}
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="e.g. 100 Riverside Dr"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-muted-foreground">Surface</span>
          <div role="radiogroup" aria-label="Surface" className="flex flex-wrap gap-2">
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
                  {option}
                </button>
              )
            })}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          {surface !== "Clay" && (
            <div className="flex flex-col gap-1.5">
              <label htmlFor={`${formId}-hard`} className="text-xs font-medium text-muted-foreground">
                Hard courts
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
                Clay courts
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
        <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>
          Cancel
        </Button>
        <Button type="submit" form={formId} variant="positive">
          Save
        </Button>
      </DialogFooter>

      {mode === "edit" && (
        <div className="mt-4 border-t border-border pt-4">
          {confirmingDelete ? (
            <div className="flex items-center gap-2">
              <p className="flex-1 text-sm text-foreground">Delete this location?</p>
              <Button type="button" variant="secondary" size="sm" onClick={() => setConfirmingDelete(false)}>
                Keep location
              </Button>
              <Button
                type="button"
                variant="destructive"
                size="sm"
                onClick={() => onDelete(location.id)}
              >
                Confirm delete
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
              Delete location
            </Button>
          )}
        </div>
      )}
    </>
  )
}
