import { cn, Field, FieldDescription, FieldLabel } from '@proteus/ui'
import { useState } from 'react'
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
  /**
   * Makes the list creatable: "Add <value>" calls this, and the caller hands `choose` the item once
   * it exists. A failed create never calls `choose`; its mutation has already said why.
   */
  onCreate?: (value: string, choose: (item: ComboboxOption) => void) => void
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
  onCreate,
  className,
}: MultiComboboxFieldProps) {
  const field = useFieldContext<string[]>()
  const isInvalid = !field.state.meta.isValid
  // A just-created item is chosen before the list refetches; offering it keeps its label showing.
  const [created, setCreated] = useState<ComboboxOption[]>([])
  const options = [...items, ...created.filter((item) => !items.some((existing) => existing.id === item.id))]

  const handleCreate = (value: string) =>
    onCreate?.(value, (item) => {
      setCreated((previous) => [...previous, item])
      field.handleChange([...field.state.value, item.id])
    })

  return (
    <Field data-invalid={isInvalid} className={cn(className)}>
      <FieldLabel>{label}</FieldLabel>
      <MultiSelectCombobox
        items={options}
        value={field.state.value}
        onValueChange={field.handleChange}
        onCreate={onCreate ? handleCreate : undefined}
        placeholder={placeholder}
        emptyMessage={emptyMessage}
      />
      {!!isInvalid && <TranslatedFieldError errors={field.state.meta.errors} />}
      {!!description && <FieldDescription>{description}</FieldDescription>}
    </Field>
  )
}
