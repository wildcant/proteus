import {
  Popover as BasePopover,
  PopoverContent as BasePopoverContent,
  PopoverTrigger as BasePopoverTrigger,
  cn,
  PopoverArrow,
} from '@proteus/ui'
import type { ComponentProps } from 'react'

/**
 * The store's popover: a short menu, so `w-auto` over the primitive's `w-72`, a `border` edge
 * instead of the ring, and `p-0 gap-0` because the items are full-width buttons carrying their own
 * `h-10 px-3`. The arrow is built in rather than left to a call site that can forget it.
 */
export function PopoverContent({
  align = 'center',
  sideOffset = 18,
  className,
  children,
  ...props
}: ComponentProps<typeof BasePopoverContent>) {
  return (
    <BasePopoverContent
      align={align}
      // Clears the arrow's own height, so the tip stops short of the trigger rather than into it.
      sideOffset={sideOffset}
      className={cn('w-auto gap-0 border p-0 shadow-xl ring-0', className)}
      {...props}
    >
      <PopoverArrow
        className={cn(
          'block h-4 w-8 overflow-clip',
          'data-[side=bottom]:-top-3.75 data-[side=top]:-bottom-3.75 data-[side=bottom]:rotate-0 data-[side=top]:rotate-180',
          'data-[side=inline-start]:-right-5.75 data-[side=left]:-right-5.75 data-[side=inline-start]:rotate-90 data-[side=left]:rotate-90',
          'data-[side=inline-end]:-left-5.75 data-[side=right]:-left-5.75 data-[side=inline-end]:-rotate-90 data-[side=right]:-rotate-90',
          "before:absolute before:bottom-0 before:left-1/2 before:size-[calc(16px*sqrt(2))] before:-translate-x-1/2 before:translate-y-1/2 before:rotate-45 before:rounded-tl-[3px] before:border before:border-foreground/10 before:bg-popover before:content-['']",
        )}
      />
      {children}
    </BasePopoverContent>
  )
}

/* Passed through so a call site takes all three parts from one import. Re-exporting the bindings
   directly trips `useComponentExportOnlyModules`, which cannot see that they are components. */
export function Popover(props: ComponentProps<typeof BasePopover>) {
  return <BasePopover {...props} />
}

export function PopoverTrigger(props: ComponentProps<typeof BasePopoverTrigger>) {
  return <BasePopoverTrigger {...props} />
}
