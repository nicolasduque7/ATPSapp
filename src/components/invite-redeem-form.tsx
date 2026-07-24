"use client"

import { useActionState } from "react"

import { redeemInvite, type RedeemState } from "@/app/invite/[token]/actions"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

const initialState: RedeemState = {}

interface InviteRedeemFormProps {
  token: string
  email: string
}

export function InviteRedeemForm({ token, email }: InviteRedeemFormProps) {
  const [state, action, pending] = useActionState(redeemInvite, initialState)

  return (
    <form action={action} className="flex flex-col gap-4">
      <input type="hidden" name="token" value={token} />

      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-medium text-muted-foreground">Email</label>
        <Input type="email" value={email} disabled readOnly />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="invite-password" className="text-xs font-medium text-muted-foreground">
          Password
        </label>
        <Input
          id="invite-password"
          name="password"
          type="password"
          autoComplete="new-password"
          required
          minLength={6}
        />
      </div>

      {state.error && <p className="text-sm text-destructive">{state.error}</p>}

      <Button type="submit" variant="positive" className="mt-2 w-full" disabled={pending}>
        {pending ? "Creating account…" : "Create account"}
      </Button>
    </form>
  )
}
