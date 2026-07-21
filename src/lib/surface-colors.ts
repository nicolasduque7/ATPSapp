import type { CourtSurface } from "@/lib/mock-data"

export interface SurfaceColorStyle {
  dot: string
  text: string
  tint: string
}

const SURFACE_COLOR_STYLES: Record<Exclude<CourtSurface, "Both">, SurfaceColorStyle> = {
  Hard: {
    dot: "bg-court-hard",
    text: "text-court-hard",
    tint: "bg-court-hard-bg",
  },
  Clay: {
    dot: "bg-court-clay",
    text: "text-court-clay",
    tint: "bg-court-clay-bg",
  },
}

export function getSurfaceColorStyle(surface: Exclude<CourtSurface, "Both">): SurfaceColorStyle {
  return SURFACE_COLOR_STYLES[surface]
}
