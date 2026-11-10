import type { AdminGroupedProduct, AdminUpdateProductResponse } from '#/api/generated/model'
import type { ComboboxOption } from '#/components/form/single-combobox-field'
import { toProductTypeOption } from '#/features/product-types/hooks/use-product-type-options'
import { useUpdateProduct } from '#/features/products/api/products'
import { useAppForm } from '#/lib/form-hook.ts'
import { errorMessage, type SubmitFormParams } from '#/types/form.ts'

export type EditProductOrganizationFormParams = SubmitFormParams<AdminUpdateProductResponse>

/** What the product is grouped under. Saving sends the whole set, which replaces the product's own. */
export function useEditProductOrganizationForm(
  product: AdminGroupedProduct,
  params?: EditProductOrganizationFormParams,
) {
  const updateMutation = useUpdateProduct(product.id)

  const form = useAppForm({
    defaultValues: {
      // The chosen item rather than its id, as `SingleComboboxField` holds it.
      type: product.type ? toProductTypeOption(product.type) : (null as ComboboxOption | null),
      categoryIds: product.categories.map((category) => category.id),
      collectionIds: product.collections.map((collection) => collection.id),
      tagIds: product.tags.map((tag) => tag.id),
    },
    onSubmit: async ({ value }) => {
      try {
        const { type, ...groupings } = value
        const data = await updateMutation.mutateAsync({ ...groupings, typeId: type?.id ?? null })
        form.reset()
        params?.onSuccess?.(data)
      } catch (error) {
        params?.onError?.(errorMessage(error))
      } finally {
        params?.onSettled?.()
      }
    },
  })

  return { form }
}
