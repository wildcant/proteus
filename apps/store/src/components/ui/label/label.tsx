import { cn } from '@proteus/ui-core'
import type { ComponentProps } from 'react'
import { label, labelText } from '#/components/ui/label/label.variants'

/** The text is the label's own children, so the text layer's type sits on the element itself. */
export function Label({ className, ...props }: ComponentProps<'label'>) {
  return (
    // biome-ignore lint/a11y/noLabelWithoutControl: the caller passes `htmlFor` or nests the control.
    <label
      data-slot="label"
      className={cn(label(), labelText(), 'select-none peer-disabled:cursor-not-allowed', className)}
      {...props}
    />
  )
}
