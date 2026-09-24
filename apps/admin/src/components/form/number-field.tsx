import { Field, FieldLabel, Input } from '@proteus/ui'
import { useId } from 'react'
import { TranslatedFieldError } from '#/components/form/field-errors'
import { useFieldContext } from '#/lib/form-context.ts'

type NumberFieldProps = Pick<React.ComponentProps<'input'>, 'placeholder' | 'disabled' | 'autoFocus' | 'className'> & {
  label: string
}

export function NumberField({ label, className, ...inputProps }: NumberFieldProps) {
  const field = useFieldContext<number | null>()
  const id = useId()
  const isInvalid = field.state.meta.isTouched && !field.state.meta.isValid

  return (
    <Field data-invalid={isInvalid} className={className}>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <Input
        id={id}
        type="number"
        name={field.name}
        value={field.state.value ?? ''}
        onBlur={field.handleBlur}
        onChange={(e) => {
          const val = e.target.value
          field.handleChange(val === '' ? null : Number(val))
        }}
        aria-invalid={isInvalid}
        {...inputProps}
      />
      {!!isInvalid && <TranslatedFieldError errors={field.state.meta.errors} />}
    </Field>
  )
}
