"use client"

import { useState } from "react"
import { format } from "date-fns"
import { Clock, Plus, Repeat } from "lucide-react"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { formatClubDate, parseDateOnly } from "@/lib/dates"
import { getLocationColorStyle } from "@/lib/location-colors"
import { ordinal, pluralUnit } from "@/components/calendar/recurrence-fields"
import { AvailabilityEditDialog } from "@/components/calendar/availability-edit-dialog"
import {
  createAvailabilityBlock,
  createAvailabilitySeries,
  deleteAvailabilityBlock,
  deleteAvailabilitySeries,
  updateAvailabilityBlock,
  updateAvailabilitySeries,
} from "@/lib/actions/availability"
import type { AvailabilitySeriesSummary } from "@/lib/queries/availability"
import type { AvailabilityBlock, Location } from "@/lib/mock-data"
import type { AvailabilityDialogTarget, AvailabilityFormSubmission } from "@/components/calendar/types"

interface SettingsViewProps {
  series: AvailabilitySeriesSummary[]
  oneOffBlocks: AvailabilityBlock[]
  locations: Location[]
}

function formatTime(hhmm: string): string {
  const [hours, minutes] = hhmm.split(":").map(Number)
  return format(new Date(1970, 0, 1, hours, minutes), "h:mm a")
}

const WEEKDAY_SHORT = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]

function formatCadenceSummary(series: AvailabilitySeriesSummary): string {
  const cadence =
    series.intervalCount === 1
      ? series.frequency
      : `Every ${series.intervalCount} ${pluralUnit(series.intervalCount, series.frequency.toLowerCase().replace("ly", ""))}`
  const pattern =
    series.frequency === "Weekly"
      ? (series.weekdays ?? []).map((d) => WEEKDAY_SHORT[d]).join(", ")
      : series.frequency === "Monthly"
        ? ordinal(series.dayOfMonth ?? 1)
        : null

  return [
    cadence,
    pattern,
    `${formatTime(series.startTime)} – ${formatTime(series.endTime)}`,
    // series.endDate is a plain "YYYY-MM-DD" string, parsed and read within
    // this one client component — no server/client Date-crossing risk, so
    // no mount-guard is needed here.
    `until ${format(parseDateOnly(series.endDate), "MMM d, yyyy")}`,
  ]
    .filter(Boolean)
    .join(" · ")
}

function LocationChips({ locationIds, locations }: { locationIds: string[]; locations: Location[] }) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {locationIds.map((id) => {
        const location = locations.find((l) => l.id === id)
        if (!location) return null
        const style = getLocationColorStyle(id, locations)
        return (
          <span key={id} className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground">
            <span className={cn("size-1.5 shrink-0 rounded-full", style.dot)} />
            {location.name}
          </span>
        )
      })}
    </div>
  )
}

export function SettingsView({ series: initialSeries, oneOffBlocks: initialOneOffBlocks, locations }: SettingsViewProps) {
  const [series, setSeries] = useState(initialSeries)
  const [oneOffBlocks, setOneOffBlocks] = useState(initialOneOffBlocks)
  const [dialogTarget, setDialogTarget] = useState<AvailabilityDialogTarget | null>(null)

  function blockToSummaryDelta(input: {
    intervalCount: number
    weekdays?: number[] | null
    dayOfMonth?: number | null
    startTime: string
    endTime: string
    locationIds: string[]
    endDate: string
  }) {
    return {
      intervalCount: input.intervalCount,
      weekdays: input.weekdays ?? null,
      dayOfMonth: input.dayOfMonth ?? null,
      startTime: input.startTime,
      endTime: input.endTime,
      locationIds: input.locationIds,
      endDate: input.endDate,
    }
  }

  async function handleSave(submission: AvailabilityFormSubmission) {
    switch (submission.kind) {
      case "one-off-create": {
        const result = await createAvailabilityBlock(submission.input)
        if (!result.ok) throw new Error(result.error)
        setOneOffBlocks((prev) => [...prev, result.data])
        return
      }
      case "series-create": {
        const result = await createAvailabilitySeries(submission.input)
        if (!result.ok) throw new Error(result.error)
        const { seriesId, blocks } = result.data
        setSeries((prev) => [
          ...prev,
          {
            id: seriesId,
            frequency: submission.input.frequency,
            intervalCount: submission.input.intervalCount,
            weekdays: submission.input.weekdays ?? null,
            dayOfMonth: submission.input.dayOfMonth ?? null,
            startTime: submission.input.startTime,
            endTime: submission.input.endTime,
            locationIds: submission.input.locationIds,
            startDate: submission.input.startDate,
            endDate: submission.input.endDate,
          },
        ])
        void blocks // materialized instances aren't listed individually in Settings
        return
      }
      case "one-off-edit": {
        if (dialogTarget?.kind !== "block") return
        const result = await updateAvailabilityBlock(dialogTarget.block.id, submission.input)
        if (!result.ok) throw new Error(result.error)
        const updated = result.data
        setOneOffBlocks((prev) => prev.map((b) => (b.id === updated.id ? updated : b)))
        return
      }
      case "series-edit": {
        const result = await updateAvailabilitySeries(submission.seriesId, submission.input)
        if (!result.ok) throw new Error(result.error)
        setSeries((prev) =>
          prev.map((s) => (s.id === submission.seriesId ? { ...s, ...blockToSummaryDelta(submission.input) } : s))
        )
        return
      }
    }
  }

  async function handleDelete(target: { kind: "block" | "series"; id: string }) {
    if (target.kind === "block") {
      const result = await deleteAvailabilityBlock(target.id)
      if (!result.ok) throw new Error(result.error)
      setOneOffBlocks((prev) => prev.filter((b) => b.id !== target.id))
    } else {
      const result = await deleteAvailabilitySeries(target.id)
      if (!result.ok) throw new Error(result.error)
      setSeries((prev) => prev.filter((s) => s.id !== target.id))
    }
    setDialogTarget(null)
  }

  const isEmpty = series.length === 0 && oneOffBlocks.length === 0

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-2xl font-bold text-foreground">Settings</h1>
          <p className="text-sm text-muted-foreground">Manage your account and preferences.</p>
        </div>
      </div>

      <div className="flex flex-col gap-4 rounded-3xl bg-card p-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-heading text-lg font-bold text-foreground">Set up working hours</h2>
            <p className="text-sm text-muted-foreground">
              Let other coaches and students see when and where you&apos;re available to teach.
            </p>
          </div>
          <Button
            type="button"
            variant="positive"
            size="icon"
            aria-label="Add working hours"
            onClick={() => setDialogTarget({ kind: "create" })}
          >
            <Plus />
          </Button>
        </div>

        {isEmpty ? (
          <div className="rounded-2xl bg-muted/50 p-4 text-sm text-muted-foreground">
            No working hours set up yet.
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {series.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => setDialogTarget({ kind: "series", series: s })}
                className="flex cursor-pointer items-start gap-3 rounded-2xl bg-muted/50 p-4 text-left transition-colors duration-200 hover:bg-accent motion-reduce:transition-none"
              >
                <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-tag-plum/10 text-tag-plum">
                  <Repeat className="size-4 stroke-[1.75]" />
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-sm font-medium text-foreground">{formatCadenceSummary(s)}</span>
                  <LocationChips locationIds={s.locationIds} locations={locations} />
                </div>
              </button>
            ))}
            {oneOffBlocks.map((block) => (
              <button
                key={block.id}
                type="button"
                onClick={() => setDialogTarget({ kind: "block", block })}
                className="flex cursor-pointer items-start gap-3 rounded-2xl bg-muted/50 p-4 text-left transition-colors duration-200 hover:bg-accent motion-reduce:transition-none"
              >
                <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <Clock className="size-4 stroke-[1.75]" />
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-sm font-medium text-foreground">
                    {formatClubDate(block.startTime, "EEE, MMM d")} · {formatClubDate(block.startTime, "h:mm a")} –{" "}
                    {formatClubDate(block.endTime, "h:mm a")}
                  </span>
                  <LocationChips locationIds={block.locationIds} locations={locations} />
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      <AvailabilityEditDialog
        target={dialogTarget}
        locations={locations}
        onOpenChange={(open) => {
          if (!open) setDialogTarget(null)
        }}
        onSave={handleSave}
        onDelete={handleDelete}
      />
    </div>
  )
}
