import { cn } from "@/lib/utils";

interface RosterBadgeProps {
  count: number;
  names?: string[];
  className?: string;
}

// "+N" pill for a Group/Match class's roster beyond the host — names (when
// known) surface via the native title tooltip, same lightweight pattern the
// compact calendar tile already uses for its own tooltip.
export function RosterBadge({ count, names, className }: RosterBadgeProps): React.JSX.Element {
  return (
    <span
      title={names && names.length > 0 ? names.join(", ") : undefined}
      className={cn(
        "inline-flex w-fit items-center rounded-full border border-primary/30 px-2.5 py-0.5 text-xs font-medium text-primary",
        className
      )}
    >
      +{count}
    </span>
  );
}
