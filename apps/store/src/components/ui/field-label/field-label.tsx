import { cn } from '@proteus/ui-core'
import type { ComponentProps } from 'react'
import { fieldLabel, fieldLabelText } from '#/components/ui/field-label/field-label.variants'

/** A `<label>` of its own rather than `Label` with overrides: the two sets draw different type. */
export function FieldLabel({ className, ...props }: ComponentProps<'label'>) {
  return (
    // biome-ignore lint/a11y/noLabelWithoutControl: the caller passes `htmlFor` or nests the control.
    <label
      data-slot="field-label"
      className={cn(fieldLabel(), fieldLabelText(), 'select-none', className)}
      {...props}
    />
  )
}
