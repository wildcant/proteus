import { Checkbox, Field, FieldLabel } from '@proteus/ui'
import { useFieldContext } from '#/lib/form-context.ts'

type CheckboxFieldProps = {
  label: string
  className?: string
}

export function CheckboxField({ label, className }: CheckboxFieldProps) {
  const field = useFieldContext<boolean>()

  return (
    <Field orientation="horizontal" className={className}>
      <Checkbox checked={field.state.value} onCheckedChange={(checked) => field.handleChange(checked)} />
      <FieldLabel>{label}</FieldLabel>
    </Field>
  )
}
