import { Popover as PopoverPrimitive } from "@base-ui/react/popover"

import { cn } from "@/lib/utils"

const Popover = PopoverPrimitive.Root
const PopoverTrigger = PopoverPrimitive.Trigger
const PopoverPortal = PopoverPrimitive.Portal

function PopoverContent({
  className,
  children,
  side = "bottom",
  sideOffset = 6,
  align = "start",
  ...props
}: PopoverPrimitive.Popup.Props & {
  side?: PopoverPrimitive.Positioner.Props["side"]
  sideOffset?: number
  align?: PopoverPrimitive.Positioner.Props["align"]
}) {
  return (
    <PopoverPortal>
      <PopoverPrimitive.Positioner side={side} sideOffset={sideOffset} className="z-50" align={align}>
        <PopoverPrimitive.Popup
          data-slot="popover-content"
          className={cn(
            "rounded-2xl border border-border bg-popover p-3 text-popover-foreground shadow-lg outline-none",
            "transition-all duration-150 motion-reduce:transition-none",
            "data-[starting-style]:scale-95 data-[starting-style]:opacity-0",
            "data-[ending-style]:scale-95 data-[ending-style]:opacity-0",
            className
          )}
          {...props}
        >
          {children}
        </PopoverPrimitive.Popup>
      </PopoverPrimitive.Positioner>
    </PopoverPortal>
  )
}

export { Popover, PopoverTrigger, PopoverContent }
