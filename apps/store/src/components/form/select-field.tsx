import { Field, FieldError } from '@proteus/ui'
import { useId } from 'react'
import { FloatingLabelSelect } from '#/components/form/select.tsx'
import { useFieldContext } from '#/lib/form-context.ts'
import { isFieldRequired } from '#/lib/schema-required.ts'

type SelectFieldProps = Pick<React.ComponentProps<'select'>, 'disabled' | 'className'> & {
  label: string
  children: React.ReactNode
}

export function SelectField({ label, className, children, ...selectProps }: SelectFieldProps) {
  const field = useFieldContext<string>()
  const id = useId()
  const isInvalid = field.state.meta.isTouched && !field.state.meta.isValid
  const isRequired = isFieldRequired(field.form.options.validators?.onSubmit, field.name)

  return (
    <Field data-invalid={isInvalid} className={className}>
      <FloatingLabelSelect
        id={id}
        label={label}
        required={isRequired}
        name={field.name}
        value={field.state.value}
        onBlur={field.handleBlur}
        onChange={(event) => field.handleChange(event.target.value)}
        aria-invalid={isInvalid}
        {...selectProps}
      >
        {children}
      </FloatingLabelSelect>
      {!!isInvalid && <FieldError errors={field.state.meta.errors} />}
    </Field>
  )
}
