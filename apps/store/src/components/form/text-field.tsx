import { Field, FieldError } from '@proteus/ui'
import { useId } from 'react'
import { FloatingLabelInput } from '#/components/form/input.tsx'
import { useFieldContext } from '#/lib/form-context.ts'
import { isFieldRequired } from '#/lib/schema-required.ts'

type TextFieldProps = Pick<
  React.ComponentProps<'input'>,
  'type' | 'disabled' | 'autoComplete' | 'autoFocus' | 'className'
> & {
  label: string
  /** A note about why the field is asked for, behind a `?` at the end of the field. */
  help?: string
}

export function TextField({ label, help, className, ...inputProps }: TextFieldProps) {
  const field = useFieldContext<string>()
  const id = useId()
  const isInvalid = field.state.meta.isTouched && !field.state.meta.isValid
  const isRequired = isFieldRequired(field.form.options.validators?.onSubmit, field.name)

  return (
    <Field data-invalid={isInvalid} className={className}>
      <FloatingLabelInput
        id={id}
        label={label}
        help={help}
        required={isRequired}
        name={field.name}
        value={field.state.value}
        onBlur={field.handleBlur}
        onChange={(event) => field.handleChange(event.target.value)}
        aria-invalid={isInvalid}
        {...inputProps}
      />
      {!!isInvalid && <FieldError errors={field.state.meta.errors} />}
    </Field>
  )
}
