import type { AvailabilityBlock, Coach, Location } from "@/lib/mock-data"
import type { CalendarAvailabilityEvent } from "@/components/calendar/types"

export function mapAvailabilityBlockToEvent(
  block: AvailabilityBlock,
  coaches: Coach[],
  locations: Location[]
): CalendarAvailabilityEvent {
  const coachName = coaches.find((c) => c.id === block.coachId)?.name ?? "Coach"
  const locationNames = block.locationIds.flatMap((id) => {
    const location = locations.find((l) => l.id === id)
    return location ? [location.name] : []
  })

  return {
    id: block.id,
    title: coachName,
    start: block.startTime,
    end: block.endTime,
    resource: {
      coachId: block.coachId,
      coachName,
      locationIds: block.locationIds,
      locationNames,
      seriesId: block.seriesId,
    },
  }
}
