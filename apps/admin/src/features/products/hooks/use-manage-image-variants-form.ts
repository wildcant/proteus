import { z } from 'zod'
import { useBatchImageVariants } from '#/features/products/api/product-variants'
import { useAppForm } from '#/lib/form-hook.ts'
import type { SubmitFormParams } from '#/types/form.ts'

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
    onSubmit: ({ value }) => {
      batchMutation.mutate(
        {
          add: value.variantIds.filter((id) => !variantIds.includes(id)),
          remove: variantIds.filter((id) => !value.variantIds.includes(id)),
        },
        {
          onSuccess: () => params.onSuccess?.(),
          onError: (error) => params.onError?.(error.message),
          onSettled: () => params.onSettled?.(),
        },
      )
    },
  })

  return { form, isLoading: batchMutation.isPending }
}
