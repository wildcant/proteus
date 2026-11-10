import type { AdminProductType } from '#/api/generated/model'
import type { ComboboxOption } from '#/components/form/single-combobox-field'
import { useCreateProductType, useSuspenseAllProductTypes } from '#/features/product-types/api/product-types'

export const toProductTypeOption = (type: AdminProductType): ComboboxOption => ({ id: type.id, label: type.value })

/**
 * What the product form's Type single-select offers — every Type — and how its "Add <value>"
 * creates one on the spot.
 */
export function useProductTypeOptions() {
  const { data: types } = useSuspenseAllProductTypes()
  const { mutateAsync: createType } = useCreateProductType()

  const createOption = (value: string): Promise<ComboboxOption | null> =>
    createType({ value })
      .then(({ type }) => toProductTypeOption(type))
      // The mutation's own `onError` has already told the merchant why.
      .catch(() => null)

  return { options: types.map(toProductTypeOption), createOption }
}
