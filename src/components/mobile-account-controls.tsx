import { LanguageToggle } from "@/components/language-toggle"
import { ThemeToggle } from "@/components/theme-toggle"
import { AccountMenu } from "@/components/account-menu"

interface MobileAccountControlsProps {
  name: string
  email: string
}

export function MobileAccountControls({ name, email }: MobileAccountControlsProps) {
  return (
    <div className="fixed top-4 right-4 z-40 flex translate-y-0 items-center gap-1 rounded-full border border-black/5 bg-sidebar/85 p-1.5 opacity-100 shadow-[0_8px_24px_rgba(0,0,0,0.08)] backdrop-blur-md transition-[opacity,transform] duration-300 ease-out motion-reduce:transition-none dark:border-white/10 md:pointer-events-none md:-translate-y-4 md:opacity-0">
      <LanguageToggle />
      <ThemeToggle />
      <AccountMenu name={name} email={email} side="bottom" />
    </div>
  )
}
