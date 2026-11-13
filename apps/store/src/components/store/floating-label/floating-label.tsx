import { cn } from '@proteus/ui-core'
import type { ComponentProps } from 'react'
import { floatingLabel, floatingLabelLabel } from '#/components/store/floating-label/floating-label.variants'
import { Label } from '#/components/ui/label/label'

type FloatingLabelProps = ComponentProps<typeof Label>

/**
 * The label half of a floating-label field, in its floated position: at the top *inside* the box,
 * clear of the border rather than notched into it. The text is the label's own children, so the
 * label layer's type sits on the element itself.
 *
 * The type is the set's `state=resting` (the 14px label) in both positions, and the floated one
 * (12px) is that label scaled by 0.857 from its left edge (`scale-[0.857] origin-left`): the input's
 * resting state grows it back to full size with a transform, which only a scale can animate.
 * `pointer-events-none` so a click on the resting label lands on the control beneath it.
 */
export function FloatingLabel({ className, ...props }: FloatingLabelProps) {
  return (
    <Label
      className={cn(
        floatingLabel(),
        floatingLabelLabel({ state: 'resting' }),
        'pointer-events-none absolute left-4 origin-left',
        'top-2.5 scale-[0.857]',
        className,
      )}
      {...props}
    />
  )
}
