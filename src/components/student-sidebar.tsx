import { Bell, CalendarDays, Home } from "lucide-react"
import { getTranslations } from "next-intl/server"

import { NavItem } from "@/components/nav-item"
import { MobileNavBar } from "@/components/mobile-nav-bar"
import { ThemeToggle } from "@/components/theme-toggle"
import { AccountMenu } from "@/components/account-menu"
import { MobileAccountControls } from "@/components/mobile-account-controls"
import { requireStudent } from "@/lib/auth"
import { getUnreadNotificationCount } from "@/lib/queries/notifications"

const iconClassName = "size-5 stroke-[1.75]"

export async function StudentSidebar(): Promise<React.JSX.Element> {
  const [student, unreadCount, t] = await Promise.all([
    requireStudent(),
    getUnreadNotificationCount(),
    getTranslations("nav"),
  ])

  const navItems = [
    { href: "/student", icon: <Home className={iconClassName} />, label: t("home") },
    { href: "/student/calendar", icon: <CalendarDays className={iconClassName} />, label: t("calendar") },
    { href: "/student/notifications", icon: <Bell className={iconClassName} />, label: t("notifications") },
  ]

  const items = navItems.map((item) => ({
    ...item,
    badgeCount: item.href === "/student/notifications" ? unreadCount : undefined,
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
          <AccountMenu name={student.name} email={student.email} />
        </div>
      </aside>
      <MobileNavBar items={items} />
      <MobileAccountControls name={student.name} email={student.email} />
    </>
  )
}
