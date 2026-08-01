"use client"

import { Users } from "lucide-react";
import { useTranslations } from "next-intl";

import { cn } from "@/lib/utils";

interface OpenClassTagProps {
  className?: string;
  iconClassName?: string;
}

export function OpenClassTag({ className, iconClassName }: OpenClassTagProps): React.JSX.Element {
  const t = useTranslations("tags");
  return (
    <span
      className={cn(
        "inline-flex w-fit items-center gap-1 rounded-full border border-positive/30 px-2.5 py-0.5 text-xs font-medium text-positive",
        className
      )}
    >
      <Users className={cn("size-3 shrink-0", iconClassName)} />
      {t("openClass")}
    </span>
  );
}
