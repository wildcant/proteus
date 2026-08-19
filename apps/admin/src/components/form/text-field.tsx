import { cn, Field, FieldError, FieldLabel, Input } from '@proteus/ui'
import { useId } from 'react'
import { useFieldContext } from '#/lib/form-context.ts'

type TextFieldProps = Pick<
  React.ComponentProps<'input'>,
  'type' | 'placeholder' | 'disabled' | 'autoComplete' | 'autoFocus' | 'className'
> & {
  label: string
  hideLabel?: boolean
}

export function TextField({ label, className, hideLabel, placeholder, ...inputProps }: TextFieldProps) {
  const field = useFieldContext<string>()
  const id = useId()
  const isInvalid = field.state.meta.isTouched && !field.state.meta.isValid

  return (
    <Field data-invalid={isInvalid} className={className}>
      <FieldLabel htmlFor={id} className={cn({ hidden: hideLabel })}>
        {label}
      </FieldLabel>
      <Input
        id={id}
        name={field.name}
        value={field.state.value}
        onBlur={field.handleBlur}
        onChange={(e) => field.handleChange(e.target.value)}
        aria-invalid={isInvalid}
        placeholder={hideLabel ? label : placeholder}
        {...inputProps}
      />
      {isInvalid && <FieldError errors={field.state.meta.errors} />}
    </Field>
  )
}
