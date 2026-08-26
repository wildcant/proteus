import { cn, Label } from '@proteus/ui'
import type { ComponentProps } from 'react'

type FloatingLabelProps = ComponentProps<typeof Label>

/**
 * The label half of a floating-label field, in its floated position: at the top *inside* the box,
 * clear of the border rather than notched into it.
 * `pointer-events-none` so a click on the resting label lands on the control beneath it.
 */
export function FloatingLabel({ className, ...props }: FloatingLabelProps) {
  return (
    <Label
      className={cn(
        'pointer-events-none absolute left-4 origin-left text-ink-muted text-sm',
        'top-2.5 scale-[0.857]',
        className,
      )}
      {...props}
    />
  )
}
