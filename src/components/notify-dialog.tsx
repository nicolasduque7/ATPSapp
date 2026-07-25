"use client"

import { TriangleAlert } from "lucide-react"

import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"

interface NotifyDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  message?: string
}

const DEFAULT_MESSAGE = "Don't forget to notify the coach/student about these changes."

export function NotifyDialog({ open, onOpenChange, message = DEFAULT_MESSAGE }: NotifyDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent showClose={false} className="max-w-sm text-center">
        <DialogHeader className="items-center gap-2 pr-0">
          <TriangleAlert className="size-8 text-foreground" />
          <DialogTitle>Reminder</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">{message}</p>
        <DialogFooter className="justify-center">
          <Button type="button" onClick={() => onOpenChange(false)}>
            Got it
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
