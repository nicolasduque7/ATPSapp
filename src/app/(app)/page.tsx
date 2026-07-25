import { requireCoach } from "@/lib/auth";
import { getAllClasses } from "@/lib/queries/classes";
import { getLocations } from "@/lib/queries/locations";
import { getStudents } from "@/lib/queries/students";
import {
  getBusiestDayThisWeek,
  getClassCountsByLevel,
  getClassesCoachedThisWeek,
  getClassesForToday,
  getDailyClassCounts,
  getHoursCoachedToday,
  getNextClass,
  getStudentsCoachedThisWeek,
} from "@/lib/dashboard";
import { AddClassButton } from "@/components/add-class-button";
import { ClassesRingStat } from "@/components/circular-progress";
import { SchedulePills } from "@/components/schedule-pills";
import { ClassesTimelineChart } from "@/components/classes-timeline-chart";
import { TodayLevelsChart } from "@/components/today-levels-chart";
import { NextClassCard } from "@/components/next-class-card";
import { CountUpNumber } from "@/components/count-up-number";

export default async function HomePage(): Promise<React.JSX.Element> {
  const [coach, classes, students, locations] = await Promise.all([
    requireCoach(),
    getAllClasses(),
    getStudents(),
    getLocations(),
  ]);

  const todayClasses = getClassesForToday(classes);
  const nextClass = getNextClass(classes);
  const hoursToday = getHoursCoachedToday(classes);
  const classesThisWeek = getClassesCoachedThisWeek(classes);
  const studentsThisWeek = getStudentsCoachedThisWeek(classes);
  const busiestDay = getBusiestDayThisWeek(classes);
  const dailyClassCounts = getDailyClassCounts(classes, 14);

  const completedToday = todayClasses.filter((c) => c.completed).length;
  const remainingToday = todayClasses.filter((c) => !c.completed).length;
  const levelCountsToday = getClassCountsByLevel(todayClasses, students);
  const firstName = coach.name.split(" ")[0];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-heading text-2xl font-bold text-foreground">Hello, {firstName}</h1>
          <p className="text-sm text-muted-foreground">
            Here&apos;s what&apos;s on your schedule.
          </p>
        </div>
        <AddClassButton students={students} locations={locations} />
      </div>

      <NextClassCard nextClass={nextClass} students={students} locations={locations} />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 sm:col-span-2">
          <div className="flex animate-in fade-in slide-in-from-bottom-2 fill-mode-both duration-300 delay-75 motion-reduce:animate-none flex-col rounded-3xl bg-card p-5">
            <p className="font-heading text-base font-bold text-foreground">Today&apos;s classes</p>
            <div className="mt-2 flex flex-1 flex-col justify-center">
              <ClassesRingStat
                completed={completedToday}
                remaining={remainingToday}
                size={56}
                strokeWidth={6}
              />
            </div>
          </div>

          <div className="flex animate-in fade-in slide-in-from-bottom-2 fill-mode-both duration-300 delay-150 motion-reduce:animate-none flex-col rounded-3xl bg-card p-5">
            <p className="font-heading text-base font-bold text-foreground">
              Today student&apos;s levels
            </p>
            <div className="mt-2 flex flex-1 flex-col justify-center">
              <TodayLevelsChart data={levelCountsToday} />
            </div>
          </div>

          <div className="flex animate-in fade-in slide-in-from-bottom-2 fill-mode-both duration-300 delay-200 motion-reduce:animate-none flex-col rounded-3xl bg-card p-5">
            <p className="font-heading text-base font-bold text-foreground">hrs</p>
            <div className="mt-2 flex flex-1 flex-col justify-center">
              <p className="font-heading text-3xl font-bold text-foreground">
                <CountUpNumber value={hoursToday} decimals={1} suffix="h" />
              </p>
              <p className="mt-1 text-xs text-muted-foreground">Hours coached today</p>
            </div>
          </div>
        </div>

        <div className="flex animate-in fade-in slide-in-from-bottom-2 fill-mode-both duration-300 delay-300 motion-reduce:animate-none flex-col rounded-3xl bg-card p-5">
          <p className="font-heading text-base font-bold text-foreground">Weekly</p>
          <div className="mt-2 flex flex-1 flex-col justify-center gap-2">
            <div>
              <p className="font-heading text-2xl font-bold text-foreground">
                <CountUpNumber value={classesThisWeek} />
              </p>
              <p className="mt-1 text-xs text-muted-foreground">Classes coached</p>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <p className="font-heading text-lg font-bold text-foreground">
                  <CountUpNumber value={studentsThisWeek} />
                </p>
                <p className="mt-1 text-xs text-muted-foreground">Students coached</p>
              </div>
              <div>
                <p className="font-heading text-lg font-bold text-foreground">
                  {busiestDay ?? "—"}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">Busiest day</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <SchedulePills classes={todayClasses} entities={students} />

      <ClassesTimelineChart data={dailyClassCounts} />
    </div>
  );
}
