import type { Coach } from "@/lib/mock-data"

export interface CoachColorStyle {
  dot: string
  border: string
  text: string
  tint: string
  glow: string
}

interface CoachPaletteEntry extends CoachColorStyle {
  cssVar: string
}

// Same deterministic index-modulo-palette approach as getLocationColorStyle
// (src/lib/location-colors.ts) — kept coach-agnostic here so it can be
// reused verbatim by a future student Calendar. `cssVar` is the same token
// as a raw custom-property name, for the calendar tiles' inline
// `--event-accent` override (Tailwind utility classes can't win against the
// more specific `.courtside-calendar .rbc-event` rules).
//
// Deliberately excludes `--primary` — that token is reserved for "your own"
// classes (hardcoded in calendar-overrides.css), so no specific coach can
// ever be assigned the same color as "mine" and become indistinguishable
// from it.
const COACH_PALETTE: CoachPaletteEntry[] = [
  {
    cssVar: "--positive",
    dot: "bg-positive",
    border: "border-positive",
    text: "text-positive",
    tint: "bg-positive/10",
    glow: "shadow-md shadow-positive/20",
  },
  {
    cssVar: "--tag-plum",
    dot: "bg-tag-plum",
    border: "border-tag-plum",
    text: "text-tag-plum",
    tint: "bg-tag-plum/10",
    glow: "shadow-md shadow-tag-plum/20",
  },
  {
    cssVar: "--tag-sky",
    dot: "bg-tag-sky",
    border: "border-tag-sky",
    text: "text-tag-sky",
    tint: "bg-tag-sky/10",
    glow: "shadow-md shadow-tag-sky/20",
  },
  {
    cssVar: "--court-clay",
    dot: "bg-court-clay",
    border: "border-court-clay",
    text: "text-court-clay",
    tint: "bg-court-clay/10",
    glow: "shadow-md shadow-court-clay/20",
  },
]

function paletteEntry(coachId: string, coaches: Coach[]): CoachPaletteEntry {
  const index = coaches.findIndex((coach) => coach.id === coachId)
  const safeIndex = index < 0 ? 0 : index
  return COACH_PALETTE[safeIndex % COACH_PALETTE.length]
}

export function getCoachColorStyle(coachId: string, coaches: Coach[]): CoachColorStyle {
  return paletteEntry(coachId, coaches)
}

// The raw `--token` custom-property name (e.g. "--tag-plum") backing a
// coach's color, for inline-styling calendar event tiles.
export function getCoachAccentVar(coachId: string, coaches: Coach[]): string {
  return paletteEntry(coachId, coaches).cssVar
}
