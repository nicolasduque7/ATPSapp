import type { ReactNode } from "react"

import { Sidebar } from "@/components/sidebar"
import { SignOutButton } from "@/components/sign-out-button"
import { LanguageToggle } from "@/components/language-toggle"

interface AppShellProps {
  children: ReactNode
  sidebar?: ReactNode
}

export function AppShell({ children, sidebar = <Sidebar /> }: AppShellProps) {
  return (
    <div className="relative flex min-h-screen gap-4 bg-background p-4">
      {sidebar}
      <main className="min-w-0 flex-1 pt-16 pb-24 md:pb-1 md:pl-20">{children}</main>
      <div className="fixed top-4 right-4 z-40 flex items-center gap-2">
        <div className="rounded-full border border-black/5 bg-sidebar/85 shadow-[0_8px_24px_rgba(0,0,0,0.08)] backdrop-blur-md dark:border-white/10 md:border-border md:bg-card md:shadow-[0_1px_3px_rgba(0,0,0,0.04)] md:backdrop-blur-none">
          <LanguageToggle />
        </div>
        <SignOutButton />
      </div>
    </div>
  )
}
