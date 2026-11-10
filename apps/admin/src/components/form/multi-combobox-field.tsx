import { cn, Field, FieldDescription, FieldLabel } from '@proteus/ui'
import { TranslatedFieldError } from '#/components/form/field-errors'
import type { ComboboxOption } from '#/components/form/single-combobox-field'
import { MultiSelectCombobox } from '#/components/multi-select-combobox'
import { useFieldContext } from '#/lib/form-context.ts'

type MultiComboboxFieldProps = {
  label: string
  items: ComboboxOption[]
  placeholder?: string
  emptyMessage?: string
  /** Shown under the control. For saying why the list is empty, not for errors. */
  description?: string
  className?: string
}

/**
 * A searchable choice of several, held in form state as the chosen **ids**.
 *
 * Ids rather than items, unlike `SingleComboboxField`: the list is the whole set, loaded once, so an
 * id can always be named from it again.
 */
export function MultiComboboxField({
  label,
  items,
  placeholder,
  emptyMessage,
  description,
  className,
}: MultiComboboxFieldProps) {
  const field = useFieldContext<string[]>()
  const isInvalid = !field.state.meta.isValid

  return (
    <Field data-invalid={isInvalid} className={cn(className)}>
      <FieldLabel>{label}</FieldLabel>
      <MultiSelectCombobox
        items={items}
        value={field.state.value}
        onValueChange={field.handleChange}
        placeholder={placeholder}
        emptyMessage={emptyMessage}
      />
      {!!isInvalid && <TranslatedFieldError errors={field.state.meta.errors} />}
      {!!description && <FieldDescription>{description}</FieldDescription>}
    </Field>
  )
}
