"use client"

import type { ReactNode } from "react"
import { useTranslations } from "next-intl"

import { NavItem } from "@/components/nav-item"

interface MobileNavBarItem {
  href: string
  icon: ReactNode
  label: string
  badgeCount?: number
}

interface MobileNavBarProps {
  items: MobileNavBarItem[]
}

export function MobileNavBar({ items }: MobileNavBarProps) {
  const t = useTranslations("nav")
  return (
    <nav
      aria-label={t("primary")}
      className="fixed inset-x-4 bottom-4 z-40 flex translate-y-0 items-center justify-around rounded-full border border-black/5 bg-sidebar/85 py-2 opacity-100 shadow-[0_8px_24px_rgba(0,0,0,0.08)] backdrop-blur-md transition-[opacity,transform] duration-300 ease-out motion-reduce:transition-none dark:border-white/10 md:pointer-events-none md:translate-y-4 md:opacity-0"
    >
      {items.map((item) => (
        <NavItem key={item.href} {...item} />
      ))}
    </nav>
  )
}
