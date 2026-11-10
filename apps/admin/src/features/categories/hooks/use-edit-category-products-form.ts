import type { AdminProductCategoryResponse } from '#/api/generated/model'
import { useSetCategoryProducts } from '#/features/categories/api/categories'
import { useAppForm } from '#/lib/form-hook.ts'
import { errorMessage, type SubmitFormParams } from '#/types/form.ts'

export type EditCategoryProductsFormParams = SubmitFormParams<AdminProductCategoryResponse>

/**
 * The Category's direct members as a set of checked ids. Saving sends only the difference from what
 * was checked when the picker opened, as `{ add, remove }`, so a product added elsewhere meanwhile
 * is left alone.
 */
export function useEditCategoryProductsForm(
  categoryId: string,
  memberIds: string[],
  params?: EditCategoryProductsFormParams,
) {
  const setMutation = useSetCategoryProducts(categoryId)

  const form = useAppForm({
    defaultValues: { productIds: memberIds },
    onSubmit: async ({ value }) => {
      const before = new Set(memberIds)
      const after = new Set(value.productIds)
      const add = value.productIds.filter((id) => !before.has(id))
      const remove = memberIds.filter((id) => !after.has(id))

      try {
        const data = await setMutation.mutateAsync({ add, remove })
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
