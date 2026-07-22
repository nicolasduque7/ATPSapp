import { getAllClasses, getLocations, getStudents } from "@/lib/mock-data";
import { StudentsView } from "@/components/students/students-view";

export default async function StudentsPage(): Promise<React.JSX.Element> {
  const [students, classes, locations] = await Promise.all([
    getStudents(),
    getAllClasses(),
    getLocations(),
  ]);

  return <StudentsView students={students} classes={classes} locations={locations} />;
}
