import { z } from 'zod'
import type { AdminProductResponseProduct } from '#/api/generated/model'
import { useUpdateProduct } from '#/features/products/api/products'
import { useUploadProductMedia } from '#/features/products/hooks/use-upload-product-media.ts'
import { getProductMedia, mediaSchema, resolveMediaPayload } from '#/features/products/utils/media'
import { useAppForm } from '#/lib/form-hook.ts'
import { errorMessage, type SubmitFormParams } from '#/types/form.ts'

export type EditProductMediaFormParams = SubmitFormParams

export function useEditProductMediaForm(product: AdminProductResponseProduct, params?: EditProductMediaFormParams) {
  const { uploadMedia } = useUploadProductMedia()
  const updateMutation = useUpdateProduct(product.id)

  const form = useAppForm({
    defaultValues: { media: getProductMedia(product) },
    validators: { onSubmit: z.object({ media: mediaSchema }) },
    onSubmit: async ({ value }) => {
      try {
        // Staged files have to reach storage before the product can reference their URLs.
        const media = await uploadMedia(value.media)

        await updateMutation.mutateAsync(resolveMediaPayload(media))
        params?.onSuccess?.()
      } catch (error) {
        params?.onError?.(errorMessage(error))
      } finally {
        params?.onSettled?.()
      }
    },
  })

  return { form }
}
