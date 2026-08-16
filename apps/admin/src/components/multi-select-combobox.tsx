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
import { Fragment, useMemo } from 'react'

type MultiSelectComboboxItem = { id: string; label: string }

type MultiSelectComboboxProps = {
  items: MultiSelectComboboxItem[]
  value: string[]
  onValueChange: (selectedIds: string[]) => void
  placeholder?: string
  emptyMessage?: string
}

export function MultiSelectCombobox({
  items,
  value,
  onValueChange,
  placeholder = 'Search...',
  emptyMessage = 'No results found.',
}: MultiSelectComboboxProps) {
  const anchor = useComboboxAnchor()
  const itemIds = useMemo(() => items.map((item) => item.id), [items])
  const labelMap = useMemo(() => new Map(items.map((item) => [item.id, item.label])), [items])

  return (
    <Combobox
      multiple
      autoHighlight
      items={itemIds}
      itemToStringLabel={(id) => labelMap.get(id) ?? id}
      value={value}
      onValueChange={onValueChange}
    >
      <ComboboxChips ref={anchor}>
        <ComboboxValue>
          {(values: string[]) => (
            <Fragment>
              {values.map((id: string) => (
                <ComboboxChip key={id}>{labelMap.get(id) ?? id}</ComboboxChip>
              ))}
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
              {labelMap.get(id) ?? id}
            </ComboboxItem>
          )}
        </ComboboxList>
      </ComboboxContent>
    </Combobox>
  )
}
