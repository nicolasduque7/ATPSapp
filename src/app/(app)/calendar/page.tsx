import { requireCoachId } from "@/lib/auth";
import { getAllClassesAllCoaches } from "@/lib/queries/classes";
import { getLocations } from "@/lib/queries/locations";
import { getStudents } from "@/lib/queries/students";
import { getCoaches } from "@/lib/queries/coaches";
import { getAllAvailabilityBlocks } from "@/lib/queries/availability";
import { ClassCalendar } from "@/components/calendar/class-calendar";
import { mapClassInstanceToEvent } from "@/components/calendar/map-class-instance";
import { mapAvailabilityBlockToEvent } from "@/components/calendar/map-availability-block";
import type { CalendarEvent } from "@/components/calendar/types";

export default async function CalendarPage(): Promise<React.JSX.Element> {
  const [currentCoachId, classes, students, locations, coaches, availabilityBlocks] = await Promise.all([
    requireCoachId(),
    getAllClassesAllCoaches(),
    getStudents(),
    getLocations(),
    getCoaches(),
    getAllAvailabilityBlocks(),
  ]);

  const classEvents: CalendarEvent[] = classes.flatMap((c) => {
    const event = mapClassInstanceToEvent(c, students, locations, coaches);
    return event ? [{ kind: "class" as const, ...event }] : [];
  });

  const availabilityEvents: CalendarEvent[] = availabilityBlocks.map((block) => ({
    kind: "availability" as const,
    ...mapAvailabilityBlockToEvent(block, coaches, locations),
  }));

  return (
    <ClassCalendar
      classEvents={classEvents}
      availabilityEvents={availabilityEvents}
      students={students}
      locations={locations}
      coaches={coaches}
      currentCoachId={currentCoachId}
    />
  );
}
