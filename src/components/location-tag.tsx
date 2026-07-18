import { cn } from "@/lib/utils";

interface LocationTagProps {
  name: string;
  className?: string;
}

export function LocationTag({ name, className }: LocationTagProps): React.JSX.Element {
  return (
    <span
      className={cn(
        "inline-flex w-fit items-center rounded-full border border-primary/30 px-2.5 py-0.5 text-xs font-medium text-primary",
        className
      )}
    >
      {name}
    </span>
  );
}
