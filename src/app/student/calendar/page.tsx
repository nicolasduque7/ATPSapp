import { getStudentClasses, getOpenClassesForStudent } from "@/lib/queries/classes";
import { getLocationsForStudent } from "@/lib/queries/locations";
import { getCoachesForStudent } from "@/lib/queries/coaches";
import { getAddableStudentsForStudent, getCurrentStudentProfile } from "@/lib/queries/students";
import { getAvailabilityBlocksForStudent } from "@/lib/queries/availability";
import { StudentCalendar } from "@/components/calendar/student-calendar";
import { mapClassInstanceToEvent } from "@/components/calendar/map-class-instance";
import { mapAvailabilityBlockToEvent } from "@/components/calendar/map-availability-block";
import { mapOpenClassToEvent } from "@/components/calendar/map-open-class";
import type { CalendarEvent } from "@/components/calendar/types";

export default async function StudentCalendarPage(): Promise<React.JSX.Element> {
  const [profile, classes, locations, coaches, availabilityBlocks, openClasses, addableStudents] = await Promise.all([
    getCurrentStudentProfile(),
    getStudentClasses(),
    getLocationsForStudent(),
    getCoachesForStudent(),
    getAvailabilityBlocksForStudent(),
    getOpenClassesForStudent(),
    getAddableStudentsForStudent(),
  ]);

  const classEvents: CalendarEvent[] = classes.flatMap((c) => {
    const event = mapClassInstanceToEvent(c, [profile, ...addableStudents], locations, coaches);
    return event ? [{ kind: "class" as const, ...event }] : [];
  });

  const availabilityEvents: CalendarEvent[] = availabilityBlocks.map((block) => ({
    kind: "availability" as const,
    ...mapAvailabilityBlockToEvent(block, coaches, locations),
  }));

  const openClassEvents: CalendarEvent[] = openClasses.flatMap((openClass) => {
    const event = mapOpenClassToEvent(openClass, locations);
    return event ? [{ kind: "class" as const, ...event }] : [];
  });

  return (
    <StudentCalendar
      classEvents={classEvents}
      availabilityEvents={availabilityEvents}
      openClassEvents={openClassEvents}
      coaches={coaches}
      locations={locations}
      studentProfile={profile}
      addableStudents={addableStudents}
    />
  );
}
