import { CalendarDays, Home, MapPin, Users } from "lucide-react"

import { NavItem } from "@/components/nav-item"
import { ThemeToggle } from "@/components/theme-toggle"
import { AccountMenu } from "@/components/account-menu"
import { requireCoach } from "@/lib/auth"

const iconClassName = "size-5 stroke-[1.75]"

const navItems = [
  { href: "/", icon: <Home className={iconClassName} />, label: "Home" },
  { href: "/calendar", icon: <CalendarDays className={iconClassName} />, label: "Calendar" },
  { href: "/locations", icon: <MapPin className={iconClassName} />, label: "Locations" },
  { href: "/students", icon: <Users className={iconClassName} />, label: "Students" },
]

export async function Sidebar(): Promise<React.JSX.Element> {
  const coach = await requireCoach()

  return (
    <aside className="sticky top-4 flex h-[calc(100vh-2rem)] w-16 shrink-0 flex-col items-center justify-between rounded-full bg-sidebar py-4 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
      <nav className="flex flex-col items-center gap-2">
        {navItems.map((item) => (
          <NavItem key={item.href} {...item} />
        ))}
      </nav>
      <div className="flex flex-col items-center gap-3">
        <ThemeToggle />
        <AccountMenu name={coach.name} email={coach.email} />
      </div>
    </aside>
  )
}
