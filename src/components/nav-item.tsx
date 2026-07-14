"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import type { ReactNode } from "react"

import { cn } from "@/lib/utils"

interface NavItemProps {
  href: string
  icon: ReactNode
  label: string
}

export function NavItem({ href, icon, label }: NavItemProps) {
  const pathname = usePathname()
  const isActive = pathname === href

  return (
    <Link
      href={href}
      title={label}
      aria-label={label}
      aria-current={isActive ? "page" : undefined}
      className={cn(
        "flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-full transition-colors duration-200 outline-none",
        "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-sidebar",
        isActive
          ? "bg-sidebar-primary text-sidebar-primary-foreground"
          : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
      )}
    >
      {icon}
    </Link>
  )
}
