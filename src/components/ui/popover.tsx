import { Popover as PopoverPrimitive } from "@base-ui/react/popover"

import { cn } from "@/lib/utils"

const Popover = PopoverPrimitive.Root
const PopoverTrigger = PopoverPrimitive.Trigger
const PopoverPortal = PopoverPrimitive.Portal

function PopoverContent({
  className,
  children,
  sideOffset = 6,
  ...props
}: PopoverPrimitive.Popup.Props & { sideOffset?: number }) {
  return (
    <PopoverPortal>
      <PopoverPrimitive.Positioner sideOffset={sideOffset} className="z-50" align="start">
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
