import { Field, FieldError, FieldLabel, Textarea } from '@proteus/ui'
import { useId } from 'react'
import { useFieldContext } from '#/lib/form-context.ts'

type TextareaFieldProps = Pick<
  React.ComponentProps<'textarea'>,
  'placeholder' | 'disabled' | 'autoFocus' | 'className' | 'rows'
> & {
  label: string
}

export function TextareaField({ label, className, ...textareaProps }: TextareaFieldProps) {
  const field = useFieldContext<string>()
  const id = useId()
  const isInvalid = field.state.meta.isTouched && !field.state.meta.isValid

  return (
    <Field data-invalid={isInvalid} className={className}>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <Textarea
        id={id}
        name={field.name}
        value={field.state.value}
        onBlur={field.handleBlur}
        onChange={(e) => field.handleChange(e.target.value)}
        aria-invalid={isInvalid}
        {...textareaProps}
      />
      {!!isInvalid && <FieldError errors={field.state.meta.errors} />}
    </Field>
  )
}
