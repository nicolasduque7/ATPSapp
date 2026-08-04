"use client"

import { useState } from "react"
import { useTranslations } from "next-intl"

import { cn } from "@/lib/utils"
import type { StudentLevel } from "@/lib/mock-data"
import {
  Combobox,
  ComboboxContent,
  ComboboxIcon,
  ComboboxInput,
  ComboboxInputGroup,
  ComboboxItem,
  ComboboxList,
} from "@/components/ui/combobox"

export interface SelectableStudent {
  id: string
  name: string
  nickname?: string
  level: StudentLevel
}

interface StudentMultiSelectFieldProps {
  id: string
  label: string
  options: SelectableStudent[]
  selectedIds: string[]
  onToggle: (id: string) => void
  maxCount: number
  // When true, the FIRST id in selectedIds is visually flagged as the host
  // (coach dialog only — the student dialog has no host concept, self is
  // always implicit).
  showHostBadge?: boolean
  hostLabel?: string
  emptyMessage?: string
}

export function StudentMultiSelectField({
  id,
  label,
  options,
  selectedIds,
  onToggle,
  maxCount,
  showHostBadge = false,
  hostLabel,
  emptyMessage,
}: StudentMultiSelectFieldProps) {
  const t = useTranslations("classForm")
  // Own the search text and filtering ourselves (plain `.map()` over a
  // locally-filtered list, same pattern as the rest of the app's dropdowns)
  // rather than handing Base UI's Combobox an `items` array that changes
  // reference on every pick — that combination was observed to leave the
  // popup showing a stale, un-refiltered list after a selection.
  const [query, setQuery] = useState("")

  // Preserves pick order (selectedIds order), not roster order — the HOST
  // badge below depends on index 0 being the first-ever-picked student.
  const selected = selectedIds
    .map((sid) => options.find((option) => option.id === sid))
    .filter((option): option is SelectableStudent => option !== undefined)

  const normalizedQuery = query.trim().toLowerCase()
  const filteredOptions = normalizedQuery
    ? options.filter((option) => `${option.name} · ${option.level}`.toLowerCase().includes(normalizedQuery))
    : options

  // Only an actual click/keyboard-select of a list item should change the
  // roster — Escape, outside clicks, and blur also fire onValueChange (with
  // the combobox's own transient value, e.g. cleared to empty) but must
  // never silently drop an already-picked student. Removal only ever
  // happens via the chip's own onClick below.
  function handleValueChange(next: SelectableStudent[], eventDetails: { reason: string }) {
    if (eventDetails.reason !== "item-press") return
    setQuery("")
    const nextIds = next.map((option) => option.id)
    const added = nextIds.find((sid) => !selectedIds.includes(sid))
    if (added) {
      onToggle(added)
      return
    }
    // Clicking an already-selected item in the list toggles it off too,
    // same as clicking its chip below.
    const removed = selectedIds.find((sid) => !nextIds.includes(sid))
    if (removed) onToggle(removed)
  }

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-xs font-medium text-muted-foreground">
        {label}
      </label>
      {options.length === 0 && emptyMessage ? (
        <p className="text-sm text-muted-foreground">{emptyMessage}</p>
      ) : (
        <>
          <Combobox
            multiple
            value={selected}
            onValueChange={handleValueChange}
            inputValue={query}
            onInputValueChange={setQuery}
            isItemEqualToValue={(a: SelectableStudent, b: SelectableStudent) => a.id === b.id}
          >
            <ComboboxInputGroup>
              <ComboboxInput id={id} placeholder={t("searchStudents")} />
              <ComboboxIcon />
            </ComboboxInputGroup>
            <ComboboxContent>
              {filteredOptions.length === 0 ? (
                <p className="px-2.5 py-2 text-sm text-muted-foreground">{t("noStudentsFound")}</p>
              ) : (
                <ComboboxList>
                  {filteredOptions.map((option) => {
                    const isSelected = selectedIds.includes(option.id)
                    const disabled = !isSelected && selectedIds.length >= maxCount
                    return (
                      <ComboboxItem key={option.id} value={option} disabled={disabled}>
                        {option.name} · {option.level}
                      </ComboboxItem>
                    )
                  })}
                </ComboboxList>
              )}
            </ComboboxContent>
          </Combobox>

          {selected.length > 0 && (
            <div role="group" aria-label={label} className="flex flex-wrap gap-2">
              {selected.map((option, index) => {
                const isHost = showHostBadge && index === 0
                return (
                  <button
                    key={option.id}
                    type="button"
                    aria-pressed="true"
                    onClick={() => onToggle(option.id)}
                    className={cn(
                      "inline-flex cursor-pointer items-center gap-1.5 rounded-full border-2 border-primary/40 bg-primary/10 px-3 py-1.5 text-sm font-medium text-primary transition-all duration-200 hover:bg-primary/15 motion-reduce:transition-none"
                    )}
                  >
                    {option.name} · {option.level}
                    {isHost && hostLabel && (
                      <span className="rounded-full bg-primary/20 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary">
                        {hostLabel}
                      </span>
                    )}
                  </button>
                )
              })}
            </div>
          )}
        </>
      )}
    </div>
  )
}
