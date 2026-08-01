"use client"

import { useTranslations } from "next-intl";

import { cn } from "@/lib/utils";
import type { ClassType } from "@/lib/mock-data";

interface ClassTypeTagProps {
  type: ClassType;
  className?: string;
}

const CLASS_TYPE_STYLES: Record<ClassType, string> = {
  Private: "border-primary/30 text-primary",
  Group: "border-tag-sky/30 text-tag-sky",
  Match: "border-court-clay/40 text-court-clay",
};

export function ClassTypeTag({ type, className }: ClassTypeTagProps): React.JSX.Element {
  const t = useTranslations("enums.classType");
  return (
    <span
      className={cn(
        "inline-flex w-fit items-center rounded-full border px-2.5 py-0.5 text-xs font-medium",
        CLASS_TYPE_STYLES[type],
        className
      )}
    >
      {t(type)}
    </span>
  );
}
