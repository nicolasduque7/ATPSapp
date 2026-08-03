import type { CourtSurface, Location } from "@/lib/mock-data";

export const LOCATION_COLUMNS = "id, name, address, surface, hard_courts, clay_courts, deactivated_at" as const;

export interface LocationRow {
  id: string;
  name: string;
  address: string | null;
  surface: CourtSurface;
  hard_courts: number;
  clay_courts: number;
  deactivated_at: string | null;
}

export function mapLocationRow(row: LocationRow): Location {
  return {
    id: row.id,
    name: row.name,
    address: row.address ?? undefined,
    surface: row.surface,
    hardCourts: row.hard_courts,
    clayCourts: row.clay_courts,
    deactivatedAt: row.deactivated_at ? new Date(row.deactivated_at) : undefined,
  };
}
