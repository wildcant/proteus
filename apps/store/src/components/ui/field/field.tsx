import { cn } from '@proteus/ui-core'
import type { VariantProps } from 'class-variance-authority'
import type { ComponentProps } from 'react'
import { field } from '#/components/ui/field/field.variants'

// `FieldSet` and `FieldGroup` are not drawn: their spacing lives here until they are.

export function FieldSet({ className, ...props }: ComponentProps<'fieldset'>) {
  return (
    <fieldset
      data-slot="field-set"
      className={cn('flex flex-col gap-4 has-[>[data-slot=radio-group]]:gap-3', className)}
      {...props}
    />
  )
}

export function FieldGroup({ className, ...props }: ComponentProps<'div'>) {
  return <div data-slot="field-group" className={cn('flex w-full flex-col gap-5', className)} {...props} />
}

export function Field({
  className,
  orientation = 'vertical',
  ...props
}: ComponentProps<'div'> & VariantProps<typeof field>) {
  return (
    // biome-ignore lint/a11y/useSemanticElements: a field is one control and its label, not a set of controls; `role="group"` ties them as the kit's field did.
    <div
      role="group"
      data-slot="field"
      data-orientation={orientation}
      className={cn(field({ orientation }), className)}
      {...props}
    />
  )
}
