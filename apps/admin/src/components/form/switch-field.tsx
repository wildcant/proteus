import { Field, FieldError, Label, Switch } from '@proteus/ui'
import { useId } from 'react'
import { useFieldContext } from '#/lib/form-context.ts'

type SwitchFieldProps = {
  label: string
  description?: string
  className?: string
}

/**
 * A boolean shown as a switch rather than a checkbox: for settings that take effect as soon as they
 * are flipped, where a checkbox reads as something to be confirmed later.
 */
export function SwitchField({ label, description, className }: SwitchFieldProps) {
  const field = useFieldContext<boolean>()
  const id = useId()
  const isInvalid = field.state.meta.isTouched && !field.state.meta.isValid

  return (
    <Field data-invalid={isInvalid} className={className}>
      <div className="flex items-center gap-x-2">
        <Switch
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
