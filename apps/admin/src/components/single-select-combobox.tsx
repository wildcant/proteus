import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
  useComboboxAnchor,
} from '@proteus/ui'
import { useMemo } from 'react'

type SingleSelectComboboxItem = { id: string; label: string }

type SingleSelectComboboxProps = {
  id?: string
  items: SingleSelectComboboxItem[]
  value: string | null
  onValueChange: (selectedId: string | null) => void
  /** Set when the list is filtered server-side, so the query can follow what was typed. */
  onInputValueChange?: (query: string) => void
  placeholder?: string
  emptyMessage?: string
  disabled?: boolean
  /** Marks the input, so a field wrapper's error styling reaches the control itself. */
  'aria-invalid'?: boolean
}

/**
 * A searchable single-choice field. The multi-select counterpart is `MultiSelectCombobox`.
 *
 * Typing narrows the list, which is what lets it stand in for a row of selects without becoming
 * unusable when the list is long.
 */
export function SingleSelectCombobox({
  id,
  items,
  value,
  onValueChange,
  onInputValueChange,
  placeholder = 'Search...',
  emptyMessage = 'No results found.',
  disabled,
  'aria-invalid': ariaInvalid,
}: SingleSelectComboboxProps) {
  const anchor = useComboboxAnchor()
  const itemIds = useMemo(() => items.map((item) => item.id), [items])
  const labelMap = useMemo(() => new Map(items.map((item) => [item.id, item.label])), [items])

  return (
    <Combobox
      autoHighlight
      disabled={disabled}
      items={itemIds}
      itemToStringLabel={(itemId) => labelMap.get(itemId) ?? itemId}
      value={value}
      onValueChange={(selected) => onValueChange((selected as string | null) ?? null)}
      onInputValueChange={onInputValueChange}
    >
      <div ref={anchor}>
        <ComboboxInput id={id} placeholder={placeholder} aria-invalid={ariaInvalid} />
      </div>
      <ComboboxContent anchor={anchor}>
        <ComboboxEmpty>{emptyMessage}</ComboboxEmpty>
        <ComboboxList>
          {(itemId: string) => (
            <ComboboxItem key={itemId} value={itemId}>
              {labelMap.get(itemId) ?? itemId}
            </ComboboxItem>
          )}
        </ComboboxList>
      </ComboboxContent>
    </Combobox>
  )
}
