import { useCallback, useMemo } from 'react'
import type { AdminProductOption } from '#/api/generated/model'
import { MultiSelectCombobox } from '#/components/multi-select-combobox'

export type OptionValueEntry = { optionId: string; valueIds: string[] }

type OptionValueSelectorProps = {
  /** Every option the shop offers, each with its full value set. */
  allOptions: AdminProductOption[]
  value: OptionValueEntry[]
  onChange: (value: OptionValueEntry[]) => void
}

/**
 * Which options a product offers and which of their values — the one editor both the options
 * drawer and the create wizard render.
 *
 * Says nothing about variants. What the choice does to them is the caller's to show, because a
 * product being created has none and a product already selling does.
 */
export function OptionValueSelector({ allOptions, value, onChange }: OptionValueSelectorProps) {
  const optionById = useMemo(() => new Map(allOptions.map((option) => [option.id, option])), [allOptions])
  const selectedOptionIds = useMemo(() => value.map((entry) => entry.optionId), [value])
  const optionItems = useMemo(() => allOptions.map((option) => ({ id: option.id, label: option.title })), [allOptions])

  const handleOptionsChange = useCallback(
    (selectedIds: string[]) => {
      onChange(
        selectedIds.map((optionId) => {
          const existing = value.find((entry) => entry.optionId === optionId)
          if (existing) return existing
          // Every value by default when an option is first added — a product that offers an option
          // but none of its values sells nothing.
          return { optionId, valueIds: optionById.get(optionId)?.values.map((optionValue) => optionValue.id) ?? [] }
        }),
      )
    },
    [value, onChange, optionById],
  )

  const handleValuesChange = useCallback(
    (optionId: string, valueIds: string[]) => {
      // An option offering nothing is not a dimension the product varies along, so deselecting the
      // last value drops the option rather than leaving it empty.
      if (valueIds.length === 0) {
        onChange(value.filter((entry) => entry.optionId !== optionId))
        return
      }
      onChange(value.map((entry) => (entry.optionId === optionId ? { ...entry, valueIds } : entry)))
    },
    [value, onChange],
  )

  const selectedOptions = value
    .map((entry) => optionById.get(entry.optionId))
    .filter((option): option is AdminProductOption => option !== undefined)

  if (allOptions.length === 0) {
    return <p className="text-muted-foreground text-sm">No product options available. Create one first.</p>
  }

  return (
    <>
      <div>
        <h2 className="font-medium text-sm">Product Options</h2>
        <p className="mb-3 text-muted-foreground text-sm">Select which options should be associated to this product.</p>
        <MultiSelectCombobox
          items={optionItems}
          value={selectedOptionIds}
          onValueChange={handleOptionsChange}
          placeholder="Search options..."
          emptyMessage="No options found."
        />
      </div>

      {selectedOptions.length > 0 && (
        <div>
          <h2 className="font-medium text-sm">Values</h2>
          <p className="mb-3 text-muted-foreground text-sm">Select which values to use for each option.</p>
          <div className="space-y-4">
            {selectedOptions.map((option) => (
              <div key={option.id}>
                <h3 className="mb-2 font-medium text-muted-foreground text-sm">{option.title}</h3>
                <MultiSelectCombobox
                  items={option.values.map((optionValue) => ({ id: optionValue.id, label: optionValue.value }))}
                  value={value.find((entry) => entry.optionId === option.id)?.valueIds ?? []}
                  onValueChange={(valueIds) => handleValuesChange(option.id, valueIds)}
                  placeholder="Search values..."
                  emptyMessage="No values found."
                />
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  )
}
