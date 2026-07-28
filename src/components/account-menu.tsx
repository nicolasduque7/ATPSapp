"use client"

import { LogOut } from "lucide-react"

import { Avatar } from "@/components/avatar"
import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { signOut } from "@/lib/actions/auth"

interface AccountMenuProps {
  name: string
  email: string
  side?: "right" | "bottom"
}

export function AccountMenu({ name, email, side = "right" }: AccountMenuProps) {
  return (
    <Popover>
      <PopoverTrigger
        type="button"
        aria-label="Account menu"
        className="cursor-pointer rounded-full border-0 bg-transparent p-0 outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-sidebar"
      >
        <Avatar name={name} />
      </PopoverTrigger>
      <PopoverContent side={side} align="end" className="w-56">
        <div className="flex flex-col gap-0.5 px-1 pb-2">
          <p className="truncate font-heading text-sm font-bold text-foreground">{name}</p>
          <p className="truncate text-xs text-muted-foreground">{email}</p>
        </div>
        <form action={signOut}>
          <Button
            type="submit"
            variant="ghost"
            className="w-full justify-start gap-2 text-destructive hover:bg-destructive/10"
          >
            <LogOut />
            Sign out
          </Button>
        </form>
      </PopoverContent>
    </Popover>
  )
}
