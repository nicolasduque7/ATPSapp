"use client"

import { useMemo, useState } from "react"
import { MapPin, Plus } from "lucide-react"
import { useTranslations } from "next-intl"

import { Button } from "@/components/ui/button"
import { SurfacePill } from "@/components/locations/surface-pill"
import { SegmentedToggle } from "@/components/calendar/recurrence-fields"
import { LocationEditDialog } from "@/components/locations/location-edit-dialog"
import {
  createLocation,
  deactivateLocation,
  deleteLocation,
  reactivateLocation,
  updateLocation,
  type LocationInput,
} from "@/lib/actions/locations"
import type { Location } from "@/lib/mock-data"

interface LocationsViewProps {
  locations: Location[]
}

const DRAFT_LOCATION: Location = {
  id: "draft",
  name: "",
  address: "",
  surface: "Hard",
  hardCourts: 0,
  clayCourts: 0,
}

export function LocationsView({ locations: initialLocations }: LocationsViewProps) {
  const t = useTranslations("locations")
  const [locations, setLocations] = useState(initialLocations)
  const [editingLocation, setEditingLocation] = useState<Location | null>(null)
  const [mode, setMode] = useState<"create" | "edit">("edit")
  const [statusFilter, setStatusFilter] = useState<"active" | "deactivated">("active")

  const visibleLocations = useMemo(
    () =>
      locations.filter((location) =>
        statusFilter === "active" ? !location.deactivatedAt : !!location.deactivatedAt
      ),
    [locations, statusFilter]
  )

  function handleAddClick() {
    setMode("create")
    setEditingLocation(DRAFT_LOCATION)
  }

  function handleCardClick(location: Location) {
    setMode("edit")
    setEditingLocation(location)
  }

  async function handleSave(input: LocationInput) {
    if (mode === "create") {
      const result = await createLocation(input)
      if (!result.ok) throw new Error(result.error)
      setLocations((prev) => [...prev, result.data])
    } else if (editingLocation) {
      const result = await updateLocation(editingLocation.id, input)
      if (!result.ok) throw new Error(result.error)
      const saved = result.data
      setLocations((prev) => prev.map((location) => (location.id === saved.id ? saved : location)))
    }
  }

  async function handleDelete(locationId: string) {
    const result = await deleteLocation(locationId)
    if (!result.ok) throw new Error(result.error)
    setLocations((prev) => prev.filter((location) => location.id !== locationId))
    setEditingLocation(null)
  }

  async function handleDeactivate(locationId: string) {
    const result = await deactivateLocation(locationId)
    if (!result.ok) throw new Error(result.error)
    setLocations((prev) =>
      prev.map((location) => (location.id === locationId ? { ...location, deactivatedAt: new Date() } : location))
    )
    setEditingLocation(null)
  }

  async function handleReactivate(locationId: string) {
    const result = await reactivateLocation(locationId)
    if (!result.ok) throw new Error(result.error)
    setLocations((prev) =>
      prev.map((location) => (location.id === locationId ? { ...location, deactivatedAt: undefined } : location))
    )
    setEditingLocation(null)
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-2xl font-bold text-foreground">{t("title")}</h1>
          <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
        </div>
        <Button
          type="button"
          variant="positive"
          size="icon"
          aria-label={t("addLocation")}
          onClick={handleAddClick}
        >
          <Plus />
        </Button>
      </div>

      <div className="w-fit">
        <SegmentedToggle
          ariaLabel={t("filterStatus")}
          value={statusFilter}
          onChange={setStatusFilter}
          options={[
            { value: "active", label: t("active") },
            { value: "deactivated", label: t("deactivated") },
          ]}
        />
      </div>

      {visibleLocations.length === 0 ? (
        <div className="rounded-3xl bg-card p-6 text-sm text-muted-foreground">
          {statusFilter === "active" ? t("empty") : t("emptyDeactivated")}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {visibleLocations.map((location) => (
            <button
              key={location.id}
              type="button"
              onClick={() => handleCardClick(location)}
              className="flex cursor-pointer items-start gap-3 rounded-3xl bg-card p-6 text-left transition-colors duration-200 hover:bg-accent focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50 motion-reduce:transition-none"
            >
              <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                <MapPin className="size-5 stroke-[1.75]" />
              </div>
              <div className="flex flex-col gap-1.5">
                <span className="font-heading text-base font-bold text-foreground">
                  {location.name}
                </span>
                {location.address && (
                  <span className="text-sm text-muted-foreground">
                    {location.address}
                  </span>
                )}
                <div className="flex flex-wrap items-center gap-1.5 mt-1">
                  <SurfacePill
                    surface={location.surface}
                    totalCourts={location.hardCourts + location.clayCourts}
                  />
                  {location.deactivatedAt && (
                    <span className="w-fit rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
                      {t("deactivated")}
                    </span>
                  )}
                </div>
              </div>
            </button>
          ))}
        </div>
      )}

      <LocationEditDialog
        location={editingLocation}
        mode={mode}
        onOpenChange={(open) => {
          if (!open) setEditingLocation(null)
        }}
        onSave={handleSave}
        onDelete={handleDelete}
        onDeactivate={handleDeactivate}
        onReactivate={handleReactivate}
      />
    </div>
  )
}
