import type { ReactNode } from "react"

import { Sidebar } from "@/components/sidebar"

interface AppShellProps {
  children: ReactNode
}

export function AppShell({ children }: AppShellProps) {
  return (
    <div className="flex min-h-screen gap-4 bg-background p-4">
      <Sidebar />
      <main className="min-w-0 flex-1 py-1">{children}</main>
    </div>
  )
}
