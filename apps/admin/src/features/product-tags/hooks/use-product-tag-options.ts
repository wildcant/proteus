import type { AdminProductTag } from '#/api/generated/model'
import type { ComboboxOption } from '#/components/form/single-combobox-field'
import { useCreateProductTag, useSuspenseAllProductTags } from '#/features/product-tags/api/product-tags'

const toProductTagOption = (tag: AdminProductTag): ComboboxOption => ({ id: tag.id, label: tag.value })

/**
 * What the product form's Tags multi-select offers — every Tag — and how its "Add <value>" creates
 * one on the spot.
 */
export function useProductTagOptions() {
  const { data: tags } = useSuspenseAllProductTags()
  const { mutateAsync: createTag } = useCreateProductTag()

  const createOption = (value: string): Promise<ComboboxOption | null> =>
    createTag({ value })
      .then(({ tag }) => toProductTagOption(tag))
      // The mutation's own `onError` has already told the merchant why.
      .catch(() => null)

  return { options: tags.map(toProductTagOption), createOption }
}
