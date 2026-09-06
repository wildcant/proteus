import { z } from 'zod'
import type { AdminProductResponseProduct } from '#/api/generated/model'
import { useUpdateProduct } from '#/features/products/api/products'
import { useUploadProductMedia } from '#/features/products/hooks/use-upload-product-media.ts'
import { getProductMedia, mediaSchema, resolveMediaPayload } from '#/features/products/utils/media'
import { useAppForm } from '#/lib/form-hook.ts'
import type { SubmitFormParams } from '#/types/form.ts'

export type EditProductMediaFormParams = SubmitFormParams

export function useEditProductMediaForm(product: AdminProductResponseProduct, params?: EditProductMediaFormParams) {
  const { uploadMedia, isPending: isUploading } = useUploadProductMedia()
  const updateMutation = useUpdateProduct(product.id)

  const form = useAppForm({
    defaultValues: { media: getProductMedia(product) },
    validators: { onSubmit: z.object({ media: mediaSchema }) },
    onSubmit: async ({ value }) => {
      try {
        // Staged files have to reach storage before the product can reference their URLs.
        const media = await uploadMedia(value.media)

        updateMutation.mutate(resolveMediaPayload(media), {
          onSuccess: () => params?.onSuccess?.(),
          onError: (error) => params?.onError?.(error.message),
          onSettled: () => params?.onSettled?.(),
        })
      } catch (error) {
        // Only the upload throws here — `mutate` reports its own failures through the callbacks.
        params?.onError?.(error instanceof Error ? error.message : 'Failed to upload media')
      } finally {
        params?.onSettled?.()
      }
    },
  })

  return { form, isLoading: isUploading || updateMutation.isPending }
}
