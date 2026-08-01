import { Bell, CalendarDays, Home, MapPin, Settings, Users } from "lucide-react"
import { getTranslations } from "next-intl/server"

import { NavItem } from "@/components/nav-item"
import { MobileNavBar } from "@/components/mobile-nav-bar"
import { ThemeToggle } from "@/components/theme-toggle"
import { AccountMenu } from "@/components/account-menu"
import { requireCoach } from "@/lib/auth"
import { getUnreadNotificationCount } from "@/lib/queries/notifications"

const iconClassName = "size-5 stroke-[1.75]"

export async function Sidebar(): Promise<React.JSX.Element> {
  const [coach, unreadCount, t] = await Promise.all([
    requireCoach(),
    getUnreadNotificationCount(),
    getTranslations("nav"),
  ])

  const navItems = [
    { href: "/", icon: <Home className={iconClassName} />, label: t("home") },
    { href: "/calendar", icon: <CalendarDays className={iconClassName} />, label: t("calendar") },
    { href: "/locations", icon: <MapPin className={iconClassName} />, label: t("locations") },
    { href: "/students", icon: <Users className={iconClassName} />, label: t("students") },
    { href: "/notifications", icon: <Bell className={iconClassName} />, label: t("notifications") },
    { href: "/settings", icon: <Settings className={iconClassName} />, label: t("settings") },
  ]

  const items = navItems.map((item) => ({
    ...item,
    badgeCount: item.href === "/notifications" ? unreadCount : undefined,
  }))

  return (
    <>
      <aside className="fixed top-4 left-4 z-30 flex h-[calc(100vh-2rem)] w-16 shrink-0 -translate-x-4 flex-col items-center justify-between rounded-full bg-sidebar py-4 opacity-0 pointer-events-none shadow-[0_1px_3px_rgba(0,0,0,0.04)] transition-[opacity,transform] duration-300 ease-out motion-reduce:transition-none md:pointer-events-auto md:translate-x-0 md:opacity-100">
        <nav className="flex flex-col items-center gap-2">
          {items.map((item) => (
            <NavItem key={item.href} {...item} />
          ))}
        </nav>
        <div className="flex flex-col items-center gap-3">
          <ThemeToggle />
          <AccountMenu name={coach.name} email={coach.email} />
        </div>
      </aside>
      <MobileNavBar items={items} />
      <div className="fixed top-4 right-16 z-40 flex translate-y-0 items-center gap-1 rounded-full border border-black/5 bg-sidebar/85 p-1.5 opacity-100 shadow-[0_8px_24px_rgba(0,0,0,0.08)] backdrop-blur-md transition-[opacity,transform] duration-300 ease-out motion-reduce:transition-none dark:border-white/10 md:pointer-events-none md:-translate-y-4 md:opacity-0">
        <ThemeToggle />
        <AccountMenu name={coach.name} email={coach.email} side="bottom" />
      </div>
    </>
  )
}
