import { cn, Field, FieldDescription, FieldLabel } from '@proteus/ui'
import { useId } from 'react'
import { TranslatedFieldError } from '#/components/form/field-errors'
import { SingleSelectCombobox } from '#/components/single-select-combobox'
import { useFieldContext } from '#/lib/form-context.ts'

/** The least an item has to carry: an identity to select by and something to show. */
export type ComboboxOption = { id: string; label: string }

type SingleComboboxFieldProps<TItem extends ComboboxOption> = {
  label: string
  items: TItem[]
  placeholder?: string
  emptyMessage?: string
  /** Shown under the control. For saying why the list is empty, not for errors. */
  description?: string
  disabled?: boolean
  /** Set when the list is searched server-side, so the query follows what was typed. */
  onInputValueChange?: (query: string) => void
  /**
   * Makes the list creatable: "Add <value>" calls this, and the caller hands `choose` the item once
   * it exists. A failed create never calls `choose`; its mutation has already said why.
   */
  onCreate?: (value: string, choose: (item: TItem) => void) => void
  className?: string
  hideLabel?: boolean
}

/**
 * A searchable single choice, held in form state as the chosen **item** rather than its id.
 *
 * Holding the item is what makes this safe over a server-searched list: the id would have to be
 * looked up again at submit time, and by then the page of results it came from may have been
 * replaced by whatever was typed next.
 */
export function SingleComboboxField<TItem extends ComboboxOption>({
  label,
  items,
  placeholder,
  emptyMessage,
  description,
  disabled,
  onInputValueChange,
  onCreate,
  className,
  hideLabel,
}: SingleComboboxFieldProps<TItem>) {
  const field = useFieldContext<TItem | null>()
  const id = useId()
  // Not gated on `isTouched`: a required choice is only checked on submit, so someone who never
  // opened the list is exactly who needs to see the message.
  const isInvalid = !field.state.meta.isValid
  const selected = field.state.value
  // A just-created item is chosen before the list refetches; offering it keeps its label showing.
  const options = selected && !items.some((item) => item.id === selected.id) ? [...items, selected] : items

  const handleCreate = (value: string) => onCreate?.(value, (created) => field.handleChange(created))

  return (
    <Field data-invalid={isInvalid} className={className}>
      <FieldLabel htmlFor={id} className={cn({ hidden: hideLabel })}>
        {label}
      </FieldLabel>
      <SingleSelectCombobox
        id={id}
        items={options}
        value={selected?.id ?? null}
        onValueChange={(selectedId) => field.handleChange(options.find((item) => item.id === selectedId) ?? null)}
        onInputValueChange={onInputValueChange}
        onCreate={onCreate ? handleCreate : undefined}
        disabled={disabled}
        placeholder={placeholder}
        emptyMessage={emptyMessage}
        aria-invalid={isInvalid}
      />
      {!!isInvalid && <TranslatedFieldError errors={field.state.meta.errors} />}
      {!!description && <FieldDescription>{description}</FieldDescription>}
    </Field>
  )
}
