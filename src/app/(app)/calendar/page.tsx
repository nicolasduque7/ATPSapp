import { getAllClasses } from "@/lib/queries/classes";
import { getLocations } from "@/lib/queries/locations";
import { getStudents } from "@/lib/queries/students";
import { ClassCalendar } from "@/components/calendar/class-calendar";
import { mapClassInstanceToEvent } from "@/components/calendar/map-class-instance";
import type { CalendarClassEvent } from "@/components/calendar/types";

export default async function CalendarPage(): Promise<React.JSX.Element> {
  const [classes, students, locations] = await Promise.all([
    getAllClasses(),
    getStudents(),
    getLocations(),
  ]);

  const events: CalendarClassEvent[] = classes.flatMap((c) => {
    const event = mapClassInstanceToEvent(c, students, locations);
    return event ? [event] : [];
  });

  return <ClassCalendar events={events} students={students} locations={locations} />;
}
