import { cn } from "@/lib/utils";
import type { StudentLevel } from "@/lib/mock-data";

interface LevelBadgeProps {
  level: StudentLevel;
  className?: string;
}

export function LevelBadge({ level, className }: LevelBadgeProps): React.JSX.Element {
  return (
    <span
      className={cn(
        "inline-flex w-fit items-center rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground",
        className
      )}
    >
      {level}
    </span>
  );
}
