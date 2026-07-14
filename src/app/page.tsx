import {
  getClassesForToday,
  getLocationById,
  getNextClass,
  getStudentById,
  getThisWeeksUpcomingClasses,
  getWeeklyHoursCoached,
  mockCoach,
} from "@/lib/mock-data";

function formatTime(date: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function formatDayLabel(date: Date): string {
  const now = new Date();
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);

  if (date.toDateString() === now.toDateString()) return "Today";
  if (date.toDateString() === tomorrow.toDateString()) return "Tomorrow";

  return new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  }).format(date);
}

interface StatCardProps {
  label: string;
  value: string;
}

function StatCard({ label, value }: StatCardProps): React.JSX.Element {
  return (
    <div className="rounded-3xl bg-card p-6">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-2 font-heading text-3xl font-bold text-foreground">{value}</p>
    </div>
  );
}

export default async function HomePage(): Promise<React.JSX.Element> {
  const [todayClasses, nextClass, weekUpcoming, weeklyHours] = await Promise.all([
    getClassesForToday(),
    getNextClass(),
    getThisWeeksUpcomingClasses(),
    getWeeklyHoursCoached(),
  ]);

  const completedToday = todayClasses.filter((c) => c.completed).length;
  const remainingToday = todayClasses.filter((c) => !c.completed).length;
  const firstName = mockCoach.name.split(" ")[0];

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="font-heading text-2xl font-bold text-foreground">Hello, {firstName}</h1>
        <p className="text-sm text-muted-foreground">
          Here&apos;s what&apos;s on your schedule.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Classes completed today" value={String(completedToday)} />
        <StatCard label="Classes remaining today" value={String(remainingToday)} />
        <StatCard label="Weekly hours coached" value={`${weeklyHours}h`} />
      </div>

      <div className="rounded-3xl bg-primary p-6 text-primary-foreground">
        <p className="text-sm text-primary-foreground/70">Next class</p>
        {nextClass ? (
          <div className="mt-2 flex flex-col gap-1">
            <p className="font-heading text-2xl font-bold">
              {formatDayLabel(nextClass.startTime)} · {formatTime(nextClass.startTime)}
            </p>
            <p className="text-sm text-primary-foreground/80">
              {getStudentById(nextClass.studentId)?.name} ·{" "}
              {getLocationById(nextClass.locationId)?.name}
            </p>
          </div>
        ) : (
          <p className="mt-2 text-lg font-semibold">
            Nothing scheduled — enjoy the break.
          </p>
        )}
      </div>

      <div className="rounded-3xl bg-card p-6">
        <h2 className="text-sm font-semibold text-muted-foreground">
          This week&apos;s upcoming classes
        </h2>
        {weekUpcoming.length === 0 ? (
          <p className="mt-4 text-sm text-muted-foreground">
            No upcoming classes this week.
          </p>
        ) : (
          <ul className="mt-4 flex flex-col gap-3">
            {weekUpcoming.map((c) => {
              const student = getStudentById(c.studentId);
              const location = getLocationById(c.locationId);
              return (
                <li
                  key={c.id}
                  className="flex items-center justify-between gap-4 rounded-2xl bg-muted px-4 py-3"
                >
                  <div className="flex flex-col">
                    <span className="font-heading text-sm font-semibold text-foreground">
                      {student?.name}
                    </span>
                    <span className="text-xs text-muted-foreground">{location?.name}</span>
                  </div>
                  <span className="text-sm text-muted-foreground">
                    {formatDayLabel(c.startTime)} · {formatTime(c.startTime)}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
