"use client"

import { useState } from "react"
import Link from "next/link"
import { ArrowLeft, GraduationCap, LayoutDashboard } from "lucide-react"
import { useTranslations } from "next-intl"

import { SignupForm } from "@/components/signup-form"
import { cn } from "@/lib/utils"

type View = "choose" | "coach" | "student"

function BackButton({ onClick }: { onClick: () => void }) {
  const t = useTranslations("common")
  return (
    <button
      type="button"
      onClick={onClick}
      className="mb-4 inline-flex cursor-pointer items-center gap-1.5 text-sm font-medium text-muted-foreground outline-none transition-colors duration-200 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card"
    >
      <ArrowLeft className="size-4" />
      {t("back")}
    </button>
  )
}

interface ChooserOptionProps {
  icon: React.ReactNode
  title: string
  description: string
  onClick: () => void
}

function ChooserOption({ icon, title, description, onClick }: ChooserOptionProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex cursor-pointer items-start gap-3 rounded-2xl border border-border bg-background p-4 text-left outline-none",
        "transition-colors duration-200 hover:border-ring hover:bg-accent",
        "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card"
      )}
    >
      <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
        {icon}
      </div>
      <div className="flex flex-col gap-0.5">
        <p className="font-heading text-sm font-bold text-foreground">{title}</p>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
    </button>
  )
}

export function SignupChooser() {
  const [view, setView] = useState<View>("choose")
  const t = useTranslations("auth.signup")

  if (view === "coach") {
    return (
      <div>
        <BackButton onClick={() => setView("choose")} />
        <SignupForm />
      </div>
    )
  }

  if (view === "student") {
    return (
      <div>
        <BackButton onClick={() => setView("choose")} />
        <div className="flex flex-col items-center gap-3 py-2 text-center">
          <div className="flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
            <GraduationCap className="size-6" />
          </div>
          <p className="font-heading text-base font-bold text-foreground">{t("studentInfoTitle")}</p>
          <p className="text-sm text-muted-foreground">{t("studentInfoBody")}</p>
          <p className="mt-2 text-sm text-muted-foreground">
            {t("alreadyHaveAccount")}{" "}
            <Link
              href="/login"
              className="animate-soft-pulse-glow font-medium text-foreground underline-offset-4 hover:underline motion-reduce:animate-none"
            >
              {t("signInLink")}
            </Link>
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      <ChooserOption
        icon={<LayoutDashboard className="size-5 stroke-[1.75]" />}
        title={t("coachOptionTitle")}
        description={t("coachOptionDescription")}
        onClick={() => setView("coach")}
      />
      <ChooserOption
        icon={<GraduationCap className="size-5 stroke-[1.75]" />}
        title={t("studentOptionTitle")}
        description={t("studentOptionDescription")}
        onClick={() => setView("student")}
      />
      <p className="mt-1 text-center text-sm text-muted-foreground">
        {t("alreadyHaveAccount")}{" "}
        <Link
          href="/login"
          className="animate-soft-pulse-glow font-medium text-foreground underline-offset-4 hover:underline motion-reduce:animate-none"
        >
          {t("signInLink")}
        </Link>
      </p>
    </div>
  )
}
