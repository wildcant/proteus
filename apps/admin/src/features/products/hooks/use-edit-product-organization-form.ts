import type { AdminGroupedProduct, AdminUpdateProductResponse } from '#/api/generated/model'
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
      categoryIds: product.categories.map((category) => category.id),
      collectionIds: product.collections.map((collection) => collection.id),
    },
    onSubmit: async ({ value }) => {
      try {
        const data = await updateMutation.mutateAsync(value)
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
