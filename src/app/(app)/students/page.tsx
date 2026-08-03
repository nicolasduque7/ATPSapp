import { requireCoachId } from "@/lib/auth";
import { getStudents } from "@/lib/queries/students";
import { getUpcomingClasses } from "@/lib/queries/classes";
import { getLocations } from "@/lib/queries/locations";
import { StudentsView } from "@/components/students/students-view";

export default async function StudentsPage(): Promise<React.JSX.Element> {
  const [coachId, students, classes, locations] = await Promise.all([
    requireCoachId(),
    getStudents(),
    getUpcomingClasses(),
    getLocations(),
  ]);

  return <StudentsView coachId={coachId} students={students} classes={classes} locations={locations} />;
}
