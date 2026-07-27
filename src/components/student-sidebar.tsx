import { Bell, CalendarDays, Home } from "lucide-react"

import { NavItem } from "@/components/nav-item"
import { ThemeToggle } from "@/components/theme-toggle"
import { AccountMenu } from "@/components/account-menu"
import { requireStudent } from "@/lib/auth"
import { getUnreadNotificationCount } from "@/lib/queries/notifications"

const iconClassName = "size-5 stroke-[1.75]"

const navItems = [
  { href: "/student", icon: <Home className={iconClassName} />, label: "Home" },
  { href: "/student/calendar", icon: <CalendarDays className={iconClassName} />, label: "Calendar" },
  { href: "/student/notifications", icon: <Bell className={iconClassName} />, label: "Notifications" },
]

export async function StudentSidebar(): Promise<React.JSX.Element> {
  const [student, unreadCount] = await Promise.all([requireStudent(), getUnreadNotificationCount()])

  return (
    <aside className="sticky top-4 flex h-[calc(100vh-2rem)] w-16 shrink-0 flex-col items-center justify-between rounded-full bg-sidebar py-4 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
      <nav className="flex flex-col items-center gap-2">
        {navItems.map((item) => (
          <NavItem
            key={item.href}
            {...item}
            badgeCount={item.href === "/student/notifications" ? unreadCount : undefined}
          />
        ))}
      </nav>
      <div className="flex flex-col items-center gap-3">
        <ThemeToggle />
        <AccountMenu name={student.name} email={student.email} />
      </div>
    </aside>
  )
}
