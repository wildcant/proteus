import { Tooltip as TooltipPrimitive } from '@base-ui/react/tooltip'
import { cn } from '@proteus/ui-core'
import { tooltip, tooltipArrow, tooltipLabel } from '#/components/ui/tooltip/tooltip.variants'

export function Tooltip({ ...props }: TooltipPrimitive.Root.Props) {
  return <TooltipPrimitive.Root data-slot="tooltip" {...props} />
}

export function TooltipTrigger({ ...props }: TooltipPrimitive.Trigger.Props) {
  return <TooltipPrimitive.Trigger data-slot="tooltip-trigger" {...props} />
}

type TooltipContentProps = Omit<TooltipPrimitive.Popup.Props, 'children'> &
  Pick<TooltipPrimitive.Positioner.Props, 'align' | 'alignOffset' | 'side' | 'sideOffset'> & {
    /** The note itself: the set's `label`. */
    children: string
  }

/**
 * The arrow's place along the edge is Base UI's: it measures the trigger and writes `left` (or
 * `top`) inline, which beats the drawn position. Only its offset across the edge is the design's.
 */
export function TooltipContent({
  className,
  side = 'top',
  sideOffset = 4,
  align = 'center',
  alignOffset = 0,
  children,
  ...props
}: TooltipContentProps) {
  return (
    <TooltipPrimitive.Portal>
      <TooltipPrimitive.Positioner
        align={align}
        alignOffset={alignOffset}
        side={side}
        sideOffset={sideOffset}
        className="isolate z-50"
      >
        <TooltipPrimitive.Popup
          data-slot="tooltip-content"
          className={cn(
            tooltip(),
            'data-[state=delayed-open]:fade-in-0 data-[state=delayed-open]:zoom-in-95 data-open:fade-in-0 data-open:zoom-in-95 data-closed:fade-out-0 data-closed:zoom-out-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 origin-(--transform-origin) data-[state=delayed-open]:animate-in data-closed:animate-out data-open:animate-in',
            className,
          )}
          {...props}
        >
          <span className={tooltipLabel()}>{children}</span>
          <TooltipPrimitive.Arrow className={tooltipArrow()} />
        </TooltipPrimitive.Popup>
      </TooltipPrimitive.Positioner>
    </TooltipPrimitive.Portal>
  )
}
