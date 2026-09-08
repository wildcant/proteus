import { z } from 'zod'
import { useBatchImageVariants } from '#/features/products/api/product-variants'
import { useAppForm } from '#/lib/form-hook.ts'
import { errorMessage, type SubmitFormParams } from '#/types/form.ts'

type ManageImageVariantsFormParams = SubmitFormParams & {
  productId: string
  imageId: string
  /** The variants the image is already assigned to — the baseline the save diffs against. */
  variantIds: string[]
}

export function useManageImageVariantsForm({
  productId,
  imageId,
  variantIds,
  ...params
}: ManageImageVariantsFormParams) {
  const batchMutation = useBatchImageVariants(productId, imageId)

  const form = useAppForm({
    defaultValues: { variantIds },
    validators: { onSubmit: z.object({ variantIds: z.array(z.string()) }) },
    onSubmit: async ({ value }) => {
      try {
        await batchMutation.mutateAsync({
          add: value.variantIds.filter((id) => !variantIds.includes(id)),
          remove: variantIds.filter((id) => !value.variantIds.includes(id)),
        })
        params.onSuccess?.()
      } catch (error) {
        params.onError?.(errorMessage(error))
      } finally {
        params.onSettled?.()
      }
    },
  })

  return { form }
}
