import { Checkbox, Field, FieldLabel } from '@proteus/ui'
import { useId } from 'react'
import { useFieldContext } from '#/lib/form-context.ts'

type CheckboxFieldProps = {
  label: string
  className?: string
}

export function CheckboxField({ label, className }: CheckboxFieldProps) {
  const field = useFieldContext<boolean>()
  const id = useId()

  return (
    <Field orientation="horizontal" className={className}>
      {/* `Field` here is a plain div, not base-ui's, so nothing associates the two on its own —
          without `htmlFor` the control has no accessible name and the label does not toggle it. */}
      <Checkbox id={id} checked={field.state.value} onCheckedChange={(checked) => field.handleChange(checked)} />
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
    </Field>
  )
}
