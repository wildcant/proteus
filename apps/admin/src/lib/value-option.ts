import type { ComboboxOption } from '#/components/form/single-combobox-field'

/** A value entity — a Product Type, a Product Tag — as a combobox offers it. */
export const toValueOption = (entity: { id: string; value: string }): ComboboxOption => ({
  id: entity.id,
  label: entity.value,
})
