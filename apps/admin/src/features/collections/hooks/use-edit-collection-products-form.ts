import type { AdminProductCollectionResponse } from '#/api/generated/model'
import { useSetCollectionProducts } from '#/features/collections/api/collections'
import { useAppForm } from '#/lib/form-hook.ts'
import { errorMessage, type SubmitFormParams } from '#/types/form.ts'

/**
 * The Collection's members as a set of checked ids. Saving sends only the difference from what was
 * checked when the picker opened, as `{ add, remove }`, so a product added elsewhere meanwhile is
 * left alone — and joining this Collection never takes a product out of another.
 */
export function useEditCollectionProductsForm(
  collectionId: string,
  memberIds: string[],
  params?: SubmitFormParams<AdminProductCollectionResponse>,
) {
  const setMutation = useSetCollectionProducts(collectionId)

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
