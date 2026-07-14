import {
  getClassesForToday,
  getLocationById,
  getStudentById,
  getUpcomingClasses,
  type ClassInstance,
} from "@/lib/mock-data";
import { LevelBadge } from "@/components/level-badge";
import { LocationTag } from "@/components/location-tag";

function formatTime(date: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function formatDayHeading(date: Date): string {
  const now = new Date();
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);

  if (date.toDateString() === now.toDateString()) return "Today";
  if (date.toDateString() === tomorrow.toDateString()) return "Tomorrow";

  return new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "short",
    day: "numeric",
  }).format(date);
}

interface DayGroup {
  dateKey: string;
  date: Date;
  classes: ClassInstance[];
}

function groupByDay(classes: ClassInstance[]): DayGroup[] {
  const groups = new Map<string, DayGroup>();

  for (const c of classes) {
    const dateKey = c.startTime.toDateString();
    const group = groups.get(dateKey);
    if (group) {
      group.classes.push(c);
    } else {
      groups.set(dateKey, { dateKey, date: c.startTime, classes: [c] });
    }
  }

  return Array.from(groups.values()).sort(
    (a, b) => a.date.getTime() - b.date.getTime()
  );
}

export default async function CalendarPage(): Promise<React.JSX.Element> {
  const [today, upcoming] = await Promise.all([
    getClassesForToday(),
    getUpcomingClasses(14),
  ]);

  const merged = [...today, ...upcoming.filter((c) => !today.some((t) => t.id === c.id))];
  const dayGroups = groupByDay(merged);

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="font-heading text-2xl font-bold text-foreground">Calendar</h1>
        <p className="text-sm text-muted-foreground">
          Upcoming classes, grouped by day.
        </p>
      </div>

      <div className="rounded-3xl bg-muted px-4 py-3 text-sm text-muted-foreground">
        Full month / week / day calendar view is coming in a follow-up task — this is
        a simple list for now.
      </div>

      {dayGroups.length === 0 ? (
        <div className="rounded-3xl bg-card p-6 text-sm text-muted-foreground">
          No upcoming classes.
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {dayGroups.map((group) => (
            <div key={group.dateKey} className="rounded-3xl bg-card p-6">
              <h2 className="text-sm font-semibold text-muted-foreground">
                {formatDayHeading(group.date)}
              </h2>
              <ul className="mt-4 flex flex-col gap-3">
                {group.classes.map((c) => {
                  const student = getStudentById(c.studentId);
                  const location = getLocationById(c.locationId);
                  return (
                    <li
                      key={c.id}
                      className="flex flex-col gap-2 rounded-2xl bg-muted px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-heading text-sm font-semibold text-foreground">
                          {formatTime(c.startTime)}–{formatTime(c.endTime)}
                        </span>
                        <span className="text-sm text-foreground">{student?.name}</span>
                        {student && <LevelBadge level={student.level} />}
                      </div>
                      {location && <LocationTag name={location.name} />}
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
