import { getStudents } from "@/lib/queries/students";
import { getUpcomingClasses } from "@/lib/queries/classes";
import { getLocations } from "@/lib/queries/locations";
import { StudentsView } from "@/components/students/students-view";

export default async function StudentsPage(): Promise<React.JSX.Element> {
  const [students, classes, locations] = await Promise.all([
    getStudents(),
    getUpcomingClasses(),
    getLocations(),
  ]);

  return <StudentsView students={students} classes={classes} locations={locations} />;
}
