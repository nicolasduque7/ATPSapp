import type { Location } from "@/lib/mock-data"

export interface LocationColorStyle {
  dot: string
  border: string
  text: string
  tint: string
  glow: string
}

const LOCATION_COLOR_STYLES: LocationColorStyle[] = [
  {
    dot: "bg-primary",
    border: "border-primary",
    text: "text-primary",
    tint: "bg-primary/10",
    glow: "shadow-md shadow-primary/20",
  },
  {
    dot: "bg-positive",
    border: "border-positive",
    text: "text-positive",
    tint: "bg-positive/10",
    glow: "shadow-md shadow-positive/20",
  },
  {
    dot: "bg-tag-plum",
    border: "border-tag-plum",
    text: "text-tag-plum",
    tint: "bg-tag-plum/10",
    glow: "shadow-md shadow-tag-plum/20",
  },
  {
    dot: "bg-tag-sky",
    border: "border-tag-sky",
    text: "text-tag-sky",
    tint: "bg-tag-sky/10",
    glow: "shadow-md shadow-tag-sky/20",
  },
]

export function getLocationColorStyle(locationId: string, locations: Location[]): LocationColorStyle {
  const index = locations.findIndex((location) => location.id === locationId)
  const safeIndex = index < 0 ? 0 : index
  return LOCATION_COLOR_STYLES[safeIndex % LOCATION_COLOR_STYLES.length]
}
