import { Popover as PopoverPrimitive } from '@base-ui/react/popover'
import { cn } from '@proteus/ui-core'
import { popover, popoverArrow, popoverContent } from '#/components/ui/popover/popover.variants'

export function Popover(props: PopoverPrimitive.Root.Props) {
  return <PopoverPrimitive.Root data-slot="popover" {...props} />
}

export function PopoverTrigger(props: PopoverPrimitive.Trigger.Props) {
  return <PopoverPrimitive.Trigger data-slot="popover-trigger" {...props} />
}

type PopoverContentProps = PopoverPrimitive.Popup.Props &
  Pick<PopoverPrimitive.Positioner.Props, 'align' | 'alignOffset' | 'side' | 'sideOffset'>

const POPUP_MOTION =
  'data-[side=bottom]:slide-in-from-top-2 data-[side=inline-end]:slide-in-from-left-2 data-[side=inline-start]:slide-in-from-right-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 data-open:fade-in-0 data-open:zoom-in-95 data-closed:fade-out-0 data-closed:zoom-out-95 origin-(--transform-origin) duration-100 data-closed:animate-out data-open:animate-in'

/**
 * Where Base UI places the arrow, per side (`components.runtimePositions`), and its tip: a rotated
 * square rather than a triangle, so it can carry a border on the two edges the window exposes and
 * keep the popup's outline instead of floating in front of it.
 */
const ARROW_PLACEMENT = [
  'data-[side=bottom]:-top-3.75 data-[side=top]:-bottom-3.75 data-[side=bottom]:rotate-0 data-[side=top]:rotate-180',
  'data-[side=inline-start]:-right-5.75 data-[side=left]:-right-5.75 data-[side=inline-start]:rotate-90 data-[side=left]:rotate-90',
  'data-[side=inline-end]:-left-5.75 data-[side=right]:-left-5.75 data-[side=inline-end]:-rotate-90 data-[side=right]:-rotate-90',
  "before:absolute before:bottom-0 before:left-1/2 before:size-[calc(16px*sqrt(2))] before:-translate-x-1/2 before:translate-y-1/2 before:rotate-45 before:rounded-tl-[3px] before:border before:border-foreground/10 before:bg-popover before:content-['']",
].join(' ')

/**
 * Where the running store differs from the drawn set, kept so the popover renders as it always has:
 * content stretches to the popup's width (the set draws it start-aligned), the text inside inherits
 * the 14/20 `text-sm`, and the popup stays unpositioned, so Base UI places the arrow from the
 * positioner's edge rather than 1px inside the popup's border.
 */
const RUNNING_LAYOUT = 'static items-stretch text-sm'

/**
 * The store's popover: a short menu, so it sizes to its items, which are full-width buttons carrying
 * their own `h-10 px-3`. The arrow is built in rather than left to a call site that can forget it.
 * The caller's content is the set's `content` slot.
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
          className={cn(popover(), RUNNING_LAYOUT, POPUP_MOTION, 'z-50 outline-hidden', className)}
          {...props}
        >
          <PopoverPrimitive.Arrow data-slot="popover-arrow" className={cn(popoverArrow(), ARROW_PLACEMENT)} />
          <div className={cn(popoverContent(), 'items-stretch')}>{children}</div>
        </PopoverPrimitive.Popup>
      </PopoverPrimitive.Positioner>
    </PopoverPrimitive.Portal>
  )
}
