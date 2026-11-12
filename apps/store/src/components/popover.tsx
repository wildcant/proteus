import { Popover as PopoverPrimitive } from '@base-ui/react/popover'
import { cn } from '@proteus/ui-core'

export function Popover(props: PopoverPrimitive.Root.Props) {
  return <PopoverPrimitive.Root data-slot="popover" {...props} />
}

export function PopoverTrigger(props: PopoverPrimitive.Trigger.Props) {
  return <PopoverPrimitive.Trigger data-slot="popover-trigger" {...props} />
}

type PopoverContentProps = PopoverPrimitive.Popup.Props &
  Pick<PopoverPrimitive.Positioner.Props, 'align' | 'alignOffset' | 'side' | 'sideOffset'>

/**
 * The store's popover: a short menu, so it sizes to its items, which are full-width buttons carrying
 * their own `h-10 px-3`. The arrow is built in rather than left to a call site that can forget it.
 *
 * The arrow is a window with `overflow-clip` and a rotated square inside it, rather than a triangle:
 * a square can carry a border on the two edges the window exposes, so the arrow keeps the popup's
 * outline instead of floating in front of it.
 */
export function PopoverContent({
  align = 'center',
  alignOffset = 0,
  side = 'bottom',
  // Clears the arrow's own height, so the tip stops short of the trigger rather than into it.
  sideOffset = 18,
  className,
  children,
  ...props
}: PopoverContentProps) {
  return (
    <PopoverPrimitive.Portal>
      <PopoverPrimitive.Positioner
        align={align}
        alignOffset={alignOffset}
        side={side}
        sideOffset={sideOffset}
        className="isolate z-50"
      >
        <PopoverPrimitive.Popup
          data-slot="popover-content"
          className={cn(
            'data-[side=bottom]:slide-in-from-top-2 data-[side=inline-end]:slide-in-from-left-2 data-[side=inline-start]:slide-in-from-right-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 data-open:fade-in-0 data-open:zoom-in-95 data-closed:fade-out-0 data-closed:zoom-out-95 z-50 flex w-auto origin-(--transform-origin) flex-col border bg-popover text-popover-foreground text-sm shadow-xl outline-hidden duration-100 data-closed:animate-out data-open:animate-in',
            className,
          )}
          {...props}
        >
          <PopoverPrimitive.Arrow
            data-slot="popover-arrow"
            className={cn(
              'relative block h-4 w-8 overflow-clip',
              'data-[side=bottom]:-top-3.75 data-[side=top]:-bottom-3.75 data-[side=bottom]:rotate-0 data-[side=top]:rotate-180',
              'data-[side=inline-start]:-right-5.75 data-[side=left]:-right-5.75 data-[side=inline-start]:rotate-90 data-[side=left]:rotate-90',
              'data-[side=inline-end]:-left-5.75 data-[side=right]:-left-5.75 data-[side=inline-end]:-rotate-90 data-[side=right]:-rotate-90',
              "before:absolute before:bottom-0 before:left-1/2 before:size-[calc(16px*sqrt(2))] before:-translate-x-1/2 before:translate-y-1/2 before:rotate-45 before:rounded-tl-[3px] before:border before:border-foreground/10 before:bg-popover before:content-['']",
            )}
          />
          {children}
        </PopoverPrimitive.Popup>
      </PopoverPrimitive.Positioner>
    </PopoverPrimitive.Portal>
  )
}
