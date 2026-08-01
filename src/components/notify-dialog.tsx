"use client"

import { TriangleAlert } from "lucide-react"
import { useTranslations } from "next-intl"

import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"

interface NotifyDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  message?: string
}

export function NotifyDialog({ open, onOpenChange, message }: NotifyDialogProps) {
  const t = useTranslations("notifyDialog")
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent showClose={false} className="max-w-sm text-center">
        <DialogHeader className="items-center gap-2 pr-0">
          <TriangleAlert className="size-8 text-foreground" />
          <DialogTitle>{t("title")}</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">{message ?? t("defaultMessage")}</p>
        <DialogFooter className="justify-center">
          <Button type="button" onClick={() => onOpenChange(false)}>
            {t("gotIt")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
