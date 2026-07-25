import { requireStudent } from "@/lib/auth";
import { getStudentClasses } from "@/lib/queries/classes";
import { getLocationsForStudent } from "@/lib/queries/locations";
import { getCoachesForStudent } from "@/lib/queries/coaches";
import { getCurrentStudentProfile } from "@/lib/queries/students";
import {
  getBusiestDayThisWeek,
  getClassesCoachedThisWeek,
  getClassesForToday,
  getCoachesTrainedWithThisWeek,
  getDailyClassCounts,
  getHoursCoachedToday,
  getNextClass,
} from "@/lib/dashboard";
import { StudentAddClassButton } from "@/components/student-add-class-button";
import { ClassesRingStat } from "@/components/circular-progress";
import { StrokeRadarChart } from "@/components/stroke-radar-chart";
import { SchedulePills } from "@/components/schedule-pills";
import { ClassesTimelineChart } from "@/components/classes-timeline-chart";
import { StudentNextClassCard } from "@/components/student-next-class-card";
import { CountUpNumber } from "@/components/count-up-number";

export default async function StudentHomePage(): Promise<React.JSX.Element> {
  const [student, profile, classes, coaches, locations] = await Promise.all([
    requireStudent(),
    getCurrentStudentProfile(),
    getStudentClasses(),
    getCoachesForStudent(),
    getLocationsForStudent(),
  ]);

  const todayClasses = getClassesForToday(classes);
  const nextClass = getNextClass(classes);
  const hoursToday = getHoursCoachedToday(classes);
  const classesThisWeek = getClassesCoachedThisWeek(classes);
  const coachesThisWeek = getCoachesTrainedWithThisWeek(classes);
  const busiestDay = getBusiestDayThisWeek(classes);
  const dailyClassCounts = getDailyClassCounts(classes, 14);

  const completedToday = todayClasses.filter((c) => c.completed).length;
  const remainingToday = todayClasses.filter((c) => !c.completed).length;
  const firstName = student.name.split(" ")[0];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-heading text-2xl font-bold text-foreground">Hello, {firstName}</h1>
          <p className="text-sm text-muted-foreground">
            Here&apos;s what&apos;s on your schedule.
          </p>
        </div>
        <StudentAddClassButton coaches={coaches} locations={locations} />
      </div>

      <StudentNextClassCard
        nextClass={nextClass}
        studentProfile={profile}
        coaches={coaches}
        locations={locations}
      />

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
            <p className="font-heading text-base font-bold text-foreground">Stroke strength</p>
            <div className="mt-2 flex flex-1 flex-col justify-center">
              <StrokeRadarChart
                forehand={profile.forehandRating}
                backhand={profile.backhandRating}
                backhandSlice={profile.backhandSliceRating}
                volley={profile.volleyRating}
                serve={profile.serveRating}
                dropShot={profile.dropShotRating}
              />
            </div>
          </div>

          <div className="flex animate-in fade-in slide-in-from-bottom-2 fill-mode-both duration-300 delay-200 motion-reduce:animate-none flex-col rounded-3xl bg-card p-5">
            <p className="font-heading text-base font-bold text-foreground">hrs</p>
            <div className="mt-2 flex flex-1 flex-col justify-center">
              <p className="font-heading text-3xl font-bold text-foreground">
                <CountUpNumber value={hoursToday} decimals={1} suffix="h" />
              </p>
              <p className="mt-1 text-xs text-muted-foreground">Hours trained today</p>
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
              <p className="mt-1 text-xs text-muted-foreground">Classes trained</p>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <p className="font-heading text-lg font-bold text-foreground">
                  <CountUpNumber value={coachesThisWeek} />
                </p>
                <p className="mt-1 text-xs text-muted-foreground">Coaches trained with</p>
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

      <SchedulePills
        classes={todayClasses}
        entities={coaches}
        entityIdKey="coachId"
        calendarHref="/student/calendar"
      />

      <ClassesTimelineChart data={dailyClassCounts} />
    </div>
  );
}
