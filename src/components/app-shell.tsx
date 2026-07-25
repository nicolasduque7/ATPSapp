import type { ReactNode } from "react"

import { Sidebar } from "@/components/sidebar"
import { SignOutButton } from "@/components/sign-out-button"

interface AppShellProps {
  children: ReactNode
  sidebar?: ReactNode
}

export function AppShell({ children, sidebar = <Sidebar /> }: AppShellProps) {
  return (
    <div className="relative flex min-h-screen gap-4 bg-background p-4">
      {sidebar}
      <main className="min-w-0 flex-1 pt-16 pb-1">{children}</main>
      <SignOutButton />
    </div>
  )
}
