import { LevelBadge } from "@/components/level-badge"
import { StrokeRadarChart } from "@/components/stroke-radar-chart"
import type { PartnerStudent } from "@/lib/queries/notifications"

interface StudentPartnerCardProps {
  student: PartnerStudent
}

// Shared "who's on this class" card — used for the host's card on a
// student's own sent-request dialog, and for each joiner's card on a host's
// received-join dialog. Renders the radar chart as-is even for all-zero
// ratings (an unrated partner), matching the confirmed v1 decision.
export function StudentPartnerCard({ student }: StudentPartnerCardProps): React.JSX.Element {
  return (
    <div className="flex flex-col gap-3 rounded-2xl bg-card p-4">
      <div className="flex items-center justify-between gap-2">
        <span className="font-heading text-base font-bold text-foreground">{student.name}</span>
        <LevelBadge level={student.level} />
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {student.nickname && (
          <span className="w-fit rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
            {student.nickname}
          </span>
        )}
        {student.racketType && (
          <span className="w-fit rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
            {student.racketType}
          </span>
        )}
      </div>
      <StrokeRadarChart
        forehand={student.forehandRating}
        backhand={student.backhandRating}
        backhandSlice={student.backhandSliceRating}
        volley={student.volleyRating}
        serve={student.serveRating}
        dropShot={student.dropShotRating}
      />
    </div>
  )
}
