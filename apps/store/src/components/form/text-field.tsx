import { Field, FieldError, FieldLabel, Input } from '@proteus/ui'
import { useId } from 'react'
import { useFieldContext } from '#/lib/form-context.ts'

type TextFieldProps = Pick<
  React.ComponentProps<'input'>,
  'type' | 'placeholder' | 'disabled' | 'autoComplete' | 'autoFocus' | 'className'
> & {
  label: string
}

export function TextField({ label, className, ...inputProps }: TextFieldProps) {
  const field = useFieldContext<string>()
  const id = useId()
  const isInvalid = field.state.meta.isTouched && !field.state.meta.isValid

  return (
    <Field data-invalid={isInvalid} className={className}>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <Input
        id={id}
        name={field.name}
        value={field.state.value}
        onBlur={field.handleBlur}
        onChange={(e) => field.handleChange(e.target.value)}
        aria-invalid={isInvalid}
        {...inputProps}
      />
      {!!isInvalid && <FieldError errors={field.state.meta.errors} />}
    </Field>
  )
}
