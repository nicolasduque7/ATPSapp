"use client"

import { addDays as addCalendarDays, format } from "date-fns"
import { useLocale, useTranslations } from "next-intl"

import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { cn } from "@/lib/utils"
import { getDateFnsLocale } from "@/lib/date-locale"
import type { SeriesFrequency } from "@/lib/dates"

export const WEEKDAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
const WEEKDAY_KEYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const

export function weekdayShortLabel(index: number, t: (key: string) => string): string {
  return t(WEEKDAY_KEYS[index])
}
export const FREQUENCIES: SeriesFrequency[] = ["Daily", "Weekly", "Monthly"]
export const EVERY_OPTIONS = Array.from({ length: 12 }, (_, i) => i + 1)
export const DAY_OF_MONTH_OPTIONS = Array.from({ length: 30 }, (_, i) => i + 1)

export function buildTimeOptions(): Array<{ value: string; label: string }> {
  const options: Array<{ value: string; label: string }> = []
  for (let minutes = 6 * 60; minutes <= 22 * 60; minutes += 15) {
    const hours = Math.floor(minutes / 60)
    const mins = minutes % 60
    const value = `${hours.toString().padStart(2, "0")}:${mins.toString().padStart(2, "0")}`
    const label = format(new Date(1970, 0, 1, hours, mins), "h:mm a")
    options.push({ value, label })
  }
  return options
}

export const TIME_OPTIONS = buildTimeOptions()

export function getTimeLabel(value: string): string {
  return TIME_OPTIONS.find((option) => option.value === value)?.label ?? value
}

export function toTimeInputValue(date: Date): string {
  return `${date.getHours().toString().padStart(2, "0")}:${date
    .getMinutes()
    .toString()
    .padStart(2, "0")}`
}

interface RelativeDayLabels {
  today: string
  tomorrow: string
  yesterday: string
}

export function formatDateOffsetLabel(
  offset: number,
  today: Date,
  labels: RelativeDayLabels,
  appLocale: string = "en"
): string {
  const date = addCalendarDays(today, offset)
  const dateFnsOptions = { locale: getDateFnsLocale(appLocale) }
  if (offset === 0) return `${labels.today} · ${format(date, "MMM d", dateFnsOptions)}`
  if (offset === 1) return `${labels.tomorrow} · ${format(date, "MMM d", dateFnsOptions)}`
  if (offset === -1) return `${labels.yesterday} · ${format(date, "MMM d", dateFnsOptions)}`
  return format(date, "EEE · MMM d", dateFnsOptions)
}

export function buildOffsetRange(min: number, max: number, ...mustInclude: number[]): number[] {
  const lo = Math.min(min, ...mustInclude)
  const hi = Math.max(max, ...mustInclude)
  const offsets: number[] = []
  for (let offset = lo; offset <= hi; offset++) offsets.push(offset)
  return offsets
}

// Deprecated pure-English helpers, kept only for the one plain (non-hook)
// caller in settings-view.tsx that hasn't been threaded with a translator
// yet; every dialog in this file's own tree uses frequencyUnitLabel below.
export function pluralUnit(n: number, singular: string): string {
  return n === 1 ? singular : `${singular}s`
}

export function frequencyUnit(frequency: SeriesFrequency): string {
  switch (frequency) {
    case "Daily":
      return "day"
    case "Weekly":
      return "week"
    case "Monthly":
      return "month"
  }
}

export function frequencyUnitLabel(
  frequency: SeriesFrequency,
  count: number,
  t: (key: string) => string
): string {
  const base = frequency === "Daily" ? "day" : frequency === "Weekly" ? "week" : "month"
  return t(count === 1 ? base : `${base}s`)
}

export function ordinal(n: number, locale: string = "en"): string {
  if (locale === "es") return `${n}.º`
  const rem100 = n % 100
  if (rem100 >= 11 && rem100 <= 13) return `${n}th`
  switch (n % 10) {
    case 1:
      return `${n}st`
    case 2:
      return `${n}nd`
    case 3:
      return `${n}rd`
    default:
      return `${n}th`
  }
}

interface SegmentedToggleProps<T extends string> {
  ariaLabel: string
  value: T
  onChange: (value: T) => void
  options: Array<{ value: T; label: string }>
}

export function SegmentedToggle<T extends string>({
  ariaLabel,
  value,
  onChange,
  options,
}: SegmentedToggleProps<T>) {
  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className="grid gap-1 rounded-full bg-muted p-1"
      style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}
    >
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          role="radio"
          aria-checked={value === option.value}
          onClick={() => onChange(option.value)}
          className={cn(
            "cursor-pointer rounded-full px-3 py-1.5 text-sm font-medium transition-colors duration-200 motion-reduce:transition-none",
            value === option.value
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}

interface DateOffsetFieldProps {
  id: string
  label: string
  value: number
  onChange: (offset: number) => void
  options: number[]
  today: Date
}

export function DateOffsetField({ id, label, value, onChange, options, today }: DateOffsetFieldProps) {
  const t = useTranslations("classForm")
  const locale = useLocale()
  const labels: RelativeDayLabels = { today: t("today"), tomorrow: t("tomorrow"), yesterday: t("yesterday") }

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-xs font-medium text-muted-foreground">
        {label}
      </label>
      <Select value={String(value)} onValueChange={(v) => onChange(Number(v as string))}>
        <SelectTrigger id={id}>
          <SelectValue>{(v: string) => formatDateOffsetLabel(Number(v), today, labels, locale)}</SelectValue>
        </SelectTrigger>
        <SelectContent>
          {options.map((offset) => (
            <SelectItem key={offset} value={String(offset)}>
              {formatDateOffsetLabel(offset, today, labels, locale)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}

interface TimeFieldProps {
  id: string
  label: string
  value: string
  onChange: (value: string) => void
}

export function TimeField({ id, label, value, onChange }: TimeFieldProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-xs font-medium text-muted-foreground">
        {label}
      </label>
      <Select value={value} onValueChange={(v) => onChange(v as string)}>
        <SelectTrigger id={id}>
          <SelectValue>{(v: string) => getTimeLabel(v)}</SelectValue>
        </SelectTrigger>
        <SelectContent>
          {TIME_OPTIONS.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}

interface ReadOnlyFieldProps {
  label: string
  value: string
  caption?: string
}

export function ReadOnlyField({ label, value, caption }: ReadOnlyFieldProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <div className="flex h-9 items-center rounded-xl border border-input bg-muted px-3 text-sm text-foreground">
        {value}
      </div>
      {caption && <span className="text-[0.7rem] text-muted-foreground">{caption}</span>}
    </div>
  )
}

interface OpenClassFieldProps {
  isOpen: boolean
  onIsOpenChange: (isOpen: boolean) => void
  maxJoiners: number
  onMaxJoinersChange: (maxJoiners: number) => void
}

// capacity means ADDITIONAL joiners only, on top of the class's own student
// — see PROJECT.md's Open Class decisions.
export function OpenClassField({
  isOpen,
  onIsOpenChange,
  maxJoiners,
  onMaxJoinersChange,
}: OpenClassFieldProps) {
  const t = useTranslations("classForm")

  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-xs font-medium text-muted-foreground">{t("openClass")}</span>
      <div className="flex items-center gap-3">
        <SegmentedToggle
          ariaLabel={t("openClass")}
          value={isOpen ? "open" : "closed"}
          onChange={(value) => onIsOpenChange(value === "open")}
          options={[
            { value: "closed", label: t("closed") },
            { value: "open", label: t("open") },
          ]}
        />
        {isOpen && (
          <label className="flex items-center gap-2 text-xs text-muted-foreground">
            {t("extraSpots")}
            <Input
              type="number"
              min={1}
              value={maxJoiners}
              onChange={(e) => onMaxJoinersChange(Math.max(1, Number(e.target.value) || 1))}
              className="w-16"
            />
          </label>
        )}
      </div>
      {isOpen && <span className="text-[0.7rem] text-muted-foreground">{t("openClassCaption")}</span>}
    </div>
  )
}
