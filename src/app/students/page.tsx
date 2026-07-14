import { getStudents } from "@/lib/mock-data";
import { LevelBadge } from "@/components/level-badge";

export default async function StudentsPage(): Promise<React.JSX.Element> {
  const students = await getStudents();

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Students</h1>
        <p className="text-sm text-muted-foreground">Everyone you coach.</p>
      </div>

      {students.length === 0 ? (
        <div className="rounded-3xl bg-card p-6 text-sm text-muted-foreground">
          No students yet.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {students.map((student) => (
            <div
              key={student.id}
              className="flex flex-col gap-3 rounded-3xl bg-card p-6"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-base font-bold text-foreground">
                  {student.name}
                </span>
                <LevelBadge level={student.level} />
              </div>
              {student.nickname && (
                <span className="w-fit rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
                  {student.nickname}
                </span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
