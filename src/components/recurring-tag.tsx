"use client"

import { Repeat } from "lucide-react";
import { useTranslations } from "next-intl";

import { cn } from "@/lib/utils";

interface RecurringTagProps {
  className?: string;
  iconClassName?: string;
}

export function RecurringTag({ className, iconClassName }: RecurringTagProps): React.JSX.Element {
  const t = useTranslations("tags");
  return (
    <span
      className={cn(
        "inline-flex w-fit items-center gap-1 rounded-full border border-tag-plum/30 px-2.5 py-0.5 text-xs font-medium text-tag-plum",
        className
      )}
    >
      <Repeat className={cn("size-3 shrink-0", iconClassName)} />
      {t("recurring")}
    </span>
  );
}
