import {
  getAllClasses,
  getLocationById,
  getLocations,
  getStudentById,
  getStudents,
} from "@/lib/mock-data";
import { ClassCalendar } from "@/components/calendar/class-calendar";
import type { CalendarClassEvent } from "@/components/calendar/types";

export default async function CalendarPage(): Promise<React.JSX.Element> {
  const [classes, students, locations] = await Promise.all([
    getAllClasses(),
    getStudents(),
    getLocations(),
  ]);

  const events: CalendarClassEvent[] = classes.flatMap((c) => {
    const student = getStudentById(c.studentId);
    const location = getLocationById(c.locationId);
    if (!student || !location) return [];

    return [
      {
        id: c.id,
        title: student.name,
        start: c.startTime,
        end: c.endTime,
        resource: {
          studentId: student.id,
          studentName: student.name,
          level: student.level,
          locationId: location.id,
          locationName: location.name,
          durationMinutes: c.durationMinutes,
        },
      },
    ];
  });

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="font-heading text-2xl font-bold text-foreground">Calendar</h1>
        <p className="text-sm text-muted-foreground">
          Month, week, 3-day, and day views of your schedule.
        </p>
      </div>

      {events.length === 0 ? (
        <div className="rounded-3xl bg-card p-6 text-sm text-muted-foreground">
          No classes scheduled yet.
        </div>
      ) : (
        <ClassCalendar events={events} students={students} locations={locations} />
      )}
    </div>
  );
}
