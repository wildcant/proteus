import { Field, FieldError, FieldLabel, NativeSelect } from '@proteus/ui'
import { useId } from 'react'
import { useFieldContext } from '#/lib/form-context.ts'

type SelectFieldProps = Pick<React.ComponentProps<'select'>, 'disabled' | 'className'> & {
  label: string
  children: React.ReactNode
}

export function SelectField({ label, className, children, ...selectProps }: SelectFieldProps) {
  const field = useFieldContext<string>()
  const id = useId()
  const isInvalid = field.state.meta.isTouched && !field.state.meta.isValid

  return (
    <Field data-invalid={isInvalid} className={className}>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <NativeSelect
        id={id}
        name={field.name}
        value={field.state.value}
        onBlur={field.handleBlur}
        onChange={(e) => field.handleChange(e.target.value)}
        aria-invalid={isInvalid}
        className="w-full"
        {...selectProps}
      >
        {children}
      </NativeSelect>
      {isInvalid && <FieldError errors={field.state.meta.errors} />}
    </Field>
  )
}
