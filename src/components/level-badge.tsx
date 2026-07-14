import type { StudentLevel } from "@/lib/mock-data";

interface LevelBadgeProps {
  level: StudentLevel;
}

export function LevelBadge({ level }: LevelBadgeProps): React.JSX.Element {
  return (
    <span className="inline-flex w-fit items-center rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
      {level}
    </span>
  );
}
