import { Checkbox, Field, FieldError, Label } from '@proteus/ui'
import { useId } from 'react'
import { useFieldContext } from '#/lib/form-context.ts'

type CheckboxFieldProps = {
  label: string
  description?: string
  className?: string
}

export function CheckboxField({ label, description, className }: CheckboxFieldProps) {
  const field = useFieldContext<boolean>()
  const id = useId()
  const isInvalid = field.state.meta.isTouched && !field.state.meta.isValid

  return (
    <Field data-invalid={isInvalid} className={className}>
      <div className="flex items-center gap-x-2">
        <Checkbox
          id={id}
          name={field.name}
          checked={field.state.value}
          onCheckedChange={(checked) => field.handleChange(checked)}
        />
        <Label htmlFor={id}>{label}</Label>
      </div>
      {!!description && <p className="text-muted-foreground text-sm">{description}</p>}
      {!!isInvalid && <FieldError errors={field.state.meta.errors} />}
    </Field>
  )
}
