import { z } from 'zod'
import type { AdminProductVariantResponseVariant } from '#/api/generated/model'
import { useBatchVariantImages, useUpdateProductVariant } from '#/features/products/api/product-variants'
import { useAppForm } from '#/lib/form-hook.ts'
import type { SubmitFormParams } from '#/types/form.ts'

const variantMediaSchema = z.object({
  imageIds: z.array(z.string()),
  thumbnail: z.string().nullable(),
})

export type EditVariantMediaFormParams = SubmitFormParams

export function useEditVariantMediaForm(
  productId: string,
  variant: AdminProductVariantResponseVariant,
  params?: EditVariantMediaFormParams,
) {
  const assignedIds = (variant.images ?? []).map((image) => image.id)
  const batchMutation = useBatchVariantImages(productId, variant.id)
  const updateMutation = useUpdateProductVariant(productId, variant.id)

  const form = useAppForm({
    defaultValues: { imageIds: assignedIds, thumbnail: variant.thumbnail },
    validators: { onSubmit: variantMediaSchema },
    onSubmit: async ({ value }) => {
      try {
        // The thumbnail lives on the variant itself, so it is a separate write from the links.
        if (value.thumbnail !== variant.thumbnail) {
          await updateMutation.mutateAsync({ thumbnail: value.thumbnail })
        }

        batchMutation.mutate(
          {
            add: value.imageIds.filter((id) => !assignedIds.includes(id)),
            remove: assignedIds.filter((id) => !value.imageIds.includes(id)),
          },
          {
            onSuccess: () => params?.onSuccess?.(),
            onError: (error) => params?.onError?.(error.message),
            onSettled: () => params?.onSettled?.(),
          },
        )
      } catch (error) {
        // Only the thumbnail write throws here — `mutate` reports its own failures via callbacks.
        params?.onError?.(error instanceof Error ? error.message : 'Failed to update the variant thumbnail')
        params?.onSettled?.()
      }
    },
  })

  return { form, isLoading: batchMutation.isPending || updateMutation.isPending }
}
