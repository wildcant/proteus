import { useLingui } from '@lingui/react/macro'
import {
  Combobox,
  ComboboxChip,
  ComboboxChips,
  ComboboxChipsInput,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxItem,
  ComboboxList,
  ComboboxValue,
  useComboboxAnchor,
} from '@proteus/ui'
import { Fragment, useMemo, useState } from 'react'

type MultiSelectComboboxItem = { id: string; label: string }

type MultiSelectComboboxProps = {
  items: MultiSelectComboboxItem[]
  value: string[]
  onValueChange: (selectedIds: string[]) => void
  /**
   * Makes the list creatable: typing a label no item has exactly offers "Add <value>", which calls
   * this with the trimmed text instead of selecting anything.
   */
  onCreate?: (value: string) => void
  placeholder?: string
  emptyMessage?: string
}

/** Stands in the item list for the "Add <value>" row. Real ids carry a table prefix, so none collides. */
const CREATE_ITEM = '__create__'

/** A searchable choice of several. The single-choice counterpart is `SingleSelectCombobox`. */
export function MultiSelectCombobox({
  items,
  value,
  onValueChange,
  onCreate,
  placeholder = 'Search...',
  emptyMessage = 'No results found.',
}: MultiSelectComboboxProps) {
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
  const labelOf = (id: string) => (id === CREATE_ITEM ? t`Add "${typed}"` : (labelMap.get(id) ?? id))

  return (
    <Combobox
      multiple
      autoHighlight
      items={itemIds}
      itemToStringLabel={labelOf}
      value={value}
      onValueChange={(selectedIds: string[]) => {
        if (selectedIds.includes(CREATE_ITEM)) {
          onCreate?.(typed)
          return
        }
        onValueChange(selectedIds)
      }}
      onInputValueChange={setQuery}
    >
      <ComboboxChips ref={anchor}>
        <ComboboxValue>
          {(values: string[]) => (
            <Fragment>
              {values.map((id: string) => {
                const name = labelOf(id)
                return (
                  <ComboboxChip key={id} removeLabel={t`Remove ${name}`}>
                    {name}
                  </ComboboxChip>
                )
              })}
              <ComboboxChipsInput placeholder={placeholder} />
            </Fragment>
          )}
        </ComboboxValue>
      </ComboboxChips>
      <ComboboxContent anchor={anchor}>
        <ComboboxEmpty>{emptyMessage}</ComboboxEmpty>
        <ComboboxList>
          {(id: string) => (
            <ComboboxItem key={id} value={id}>
              {labelOf(id)}
            </ComboboxItem>
          )}
        </ComboboxList>
      </ComboboxContent>
    </Combobox>
  )
}
