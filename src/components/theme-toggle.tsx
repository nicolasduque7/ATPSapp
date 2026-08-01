"use client"

import { useTheme } from "next-themes"
import { Moon, Sun } from "lucide-react"
import { useTranslations } from "next-intl"

import { Button } from "@/components/ui/button"
import { useHasMounted } from "@/lib/hooks/use-has-mounted"

export function ThemeToggle() {
  const t = useTranslations("common")
  const { resolvedTheme, setTheme } = useTheme()
  const hasMounted = useHasMounted()
  const isDark = hasMounted && resolvedTheme === "dark"

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      aria-label={t("toggleTheme")}
      className="relative text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
      onClick={() => setTheme(isDark ? "light" : "dark")}
    >
      <Sun
        className={`absolute size-4 stroke-[1.75] transition-all duration-200 motion-reduce:transition-none ${
          isDark ? "scale-0 -rotate-90 opacity-0" : "scale-100 rotate-0 opacity-100"
        }`}
      />
      <Moon
        className={`absolute size-4 stroke-[1.75] transition-all duration-200 motion-reduce:transition-none ${
          isDark ? "scale-100 rotate-0 opacity-100" : "scale-0 rotate-90 opacity-0"
        }`}
      />
    </Button>
  )
}
