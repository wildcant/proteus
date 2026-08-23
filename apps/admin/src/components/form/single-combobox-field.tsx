import { cn, Field, FieldDescription, FieldError, FieldLabel } from '@proteus/ui'
import { useId } from 'react'
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
  className,
  hideLabel,
}: SingleComboboxFieldProps<TItem>) {
  const field = useFieldContext<TItem | null>()
  const id = useId()
  // Not gated on `isTouched`: a required choice is only checked on submit, so someone who never
  // opened the list is exactly who needs to see the message.
  const isInvalid = !field.state.meta.isValid

  return (
    <Field data-invalid={isInvalid} className={className}>
      <FieldLabel htmlFor={id} className={cn({ hidden: hideLabel })}>
        {label}
      </FieldLabel>
      <SingleSelectCombobox
        id={id}
        items={items}
        value={field.state.value?.id ?? null}
        onValueChange={(selectedId) => field.handleChange(items.find((item) => item.id === selectedId) ?? null)}
        onInputValueChange={onInputValueChange}
        disabled={disabled}
        placeholder={placeholder}
        emptyMessage={emptyMessage}
        aria-invalid={isInvalid}
      />
      {!!isInvalid && <FieldError errors={field.state.meta.errors} />}
      {!!description && <FieldDescription>{description}</FieldDescription>}
    </Field>
  )
}
