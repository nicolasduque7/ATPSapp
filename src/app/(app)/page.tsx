import { ArrowRight } from "lucide-react";

import {
  getBusiestDayThisWeek,
  getClassCountsByLevel,
  getClassesCoachedThisWeek,
  getClassesForToday,
  getDailyClassCounts,
  getHoursCoachedToday,
  getLocationById,
  getNextClass,
  getStudentById,
  getStudentsCoachedThisWeek,
  mockCoach,
} from "@/lib/mock-data";
import { Avatar } from "@/components/avatar";
import { Button } from "@/components/ui/button";
import { ClassesRingStat } from "@/components/circular-progress";
import { SchedulePills } from "@/components/schedule-pills";
import { ClassesTimelineChart } from "@/components/classes-timeline-chart";
import { TodayLevelsChart } from "@/components/today-levels-chart";
import { NextClassCountdown } from "@/components/next-class-countdown";
import { CountUpNumber } from "@/components/count-up-number";

function formatTime(date: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function formatDurationHours(durationMinutes: number): string {
  return `${durationMinutes / 60}h`;
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

export default async function HomePage(): Promise<React.JSX.Element> {
  const [
    todayClasses,
    nextClass,
    hoursToday,
    classesThisWeek,
    studentsThisWeek,
    busiestDay,
    dailyClassCounts,
  ] = await Promise.all([
    getClassesForToday(),
    getNextClass(),
    getHoursCoachedToday(),
    getClassesCoachedThisWeek(),
    getStudentsCoachedThisWeek(),
    getBusiestDayThisWeek(),
    getDailyClassCounts(14),
  ]);

  const completedToday = todayClasses.filter((c) => c.completed).length;
  const remainingToday = todayClasses.filter((c) => !c.completed).length;
  const levelCountsToday = getClassCountsByLevel(todayClasses);
  const firstName = mockCoach.name.split(" ")[0];

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="font-heading text-2xl font-bold text-foreground">Hello, {firstName}</h1>
        <p className="text-sm text-muted-foreground">
          Here&apos;s what&apos;s on your schedule.
        </p>
      </div>

      <div className="relative animate-in fade-in slide-in-from-bottom-2 fill-mode-both duration-300 motion-reduce:animate-none rounded-3xl bg-primary p-6 text-primary-foreground">
        <p className="text-sm text-primary-foreground/70">Next class</p>
        {nextClass ? (
          (() => {
            const student = getStudentById(nextClass.studentId);
            const location = getLocationById(nextClass.locationId);
            return (
              <>
                <span className="absolute top-6 right-6 inline-flex items-center rounded-full bg-primary-foreground/15 px-3 py-1 text-xs font-medium text-primary-foreground">
                  <NextClassCountdown startTime={nextClass.startTime} />
                </span>

                <div className="mt-2 flex flex-wrap items-baseline gap-x-2 gap-y-1 pr-24">
                  <p className="font-heading text-2xl font-bold">
                    {formatDayLabel(nextClass.startTime)} · {formatTime(nextClass.startTime)}
                  </p>
                  <p className="text-sm text-primary-foreground/70">
                    – {formatTime(nextClass.endTime)} · {formatDurationHours(nextClass.durationMinutes)}
                  </p>
                </div>

                {student && (
                  <div className="mt-4 flex items-center gap-3">
                    <Avatar
                      name={student.name}
                      className="bg-primary-foreground/15 text-primary-foreground"
                    />
                    <div className="flex flex-1 flex-col gap-1.5">
                      <div className="flex items-center justify-between gap-3">
                        <span className="font-heading text-sm font-bold text-primary-foreground">
                          {student.name}
                        </span>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          aria-label="View class details"
                          className="text-primary-foreground hover:bg-primary-foreground/15"
                        >
                          <ArrowRight />
                        </Button>
                      </div>
                      <div className="flex flex-wrap items-center gap-1.5">
                        {location && (
                          <span className="inline-flex w-fit items-center rounded-full bg-primary-foreground/15 px-2 py-0.5 text-[9px] font-medium text-primary-foreground/90">
                            {location.name}
                          </span>
                        )}
                        <span className="inline-flex w-fit items-center rounded-full bg-primary-foreground/15 px-2 py-0.5 text-[9px] font-medium text-primary-foreground/90">
                          {student.level}
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </>
            );
          })()
        ) : (
          <p className="mt-2 text-lg font-semibold">
            Nothing scheduled — enjoy the break.
          </p>
        )}
      </div>

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

      <SchedulePills classes={todayClasses} />

      <ClassesTimelineChart data={dailyClassCounts} />
    </div>
  );
}
