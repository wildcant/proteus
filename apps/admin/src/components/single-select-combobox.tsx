import { useLingui } from '@lingui/react/macro'
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
  useComboboxAnchor,
} from '@proteus/ui'
import { useMemo, useState } from 'react'

type SingleSelectComboboxItem = { id: string; label: string }

type SingleSelectComboboxProps = {
  id?: string
  items: SingleSelectComboboxItem[]
  value: string | null
  onValueChange: (selectedId: string | null) => void
  /** Set when the list is filtered server-side, so the query can follow what was typed. */
  onInputValueChange?: (query: string) => void
  /**
   * Makes the list creatable: typing a label no item has exactly offers "Add <value>", which calls
   * this with the trimmed text instead of selecting anything.
   */
  onCreate?: (value: string) => void
  placeholder?: string
  emptyMessage?: string
  disabled?: boolean
  /** Marks the input, so a field wrapper's error styling reaches the control itself. */
  'aria-invalid'?: boolean
}

/** Stands in the item list for the "Add <value>" row. Real ids carry a table prefix, so none collides. */
const CREATE_ITEM = '__create__'

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
  onCreate,
  placeholder = 'Search...',
  emptyMessage = 'No results found.',
  disabled,
  'aria-invalid': ariaInvalid,
}: SingleSelectComboboxProps) {
  const { t } = useLingui()
  const anchor = useComboboxAnchor()
  const [query, setQuery] = useState('')
  const typed = query.trim()
  // Exact and case-sensitive, as the values the server keeps unique are.
  const canCreate = !!onCreate && typed !== '' && !items.some((item) => item.label === typed)

  const itemIds = useMemo(
    () => [...items.map((item) => item.id), ...(canCreate ? [CREATE_ITEM] : [])],
    [items, canCreate],
  )
  const labelMap = useMemo(() => new Map(items.map((item) => [item.id, item.label])), [items])
  const labelOf = (itemId: string) => (itemId === CREATE_ITEM ? t`Add "${typed}"` : (labelMap.get(itemId) ?? itemId))

  return (
    <Combobox
      autoHighlight
      disabled={disabled}
      items={itemIds}
      itemToStringLabel={labelOf}
      value={value}
      onValueChange={(selected) => {
        if (selected === CREATE_ITEM) {
          onCreate?.(typed)
          return
        }
        onValueChange((selected as string | null) ?? null)
      }}
      onInputValueChange={(nextQuery) => {
        setQuery(nextQuery)
        onInputValueChange?.(nextQuery)
      }}
    >
      <div ref={anchor}>
        <ComboboxInput id={id} placeholder={placeholder} aria-invalid={ariaInvalid} />
      </div>
      <ComboboxContent anchor={anchor}>
        <ComboboxEmpty>{emptyMessage}</ComboboxEmpty>
        <ComboboxList>
          {(itemId: string) => (
            <ComboboxItem key={itemId} value={itemId}>
              {labelOf(itemId)}
            </ComboboxItem>
          )}
        </ComboboxList>
      </ComboboxContent>
    </Combobox>
  )
}
