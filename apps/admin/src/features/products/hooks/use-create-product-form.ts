import { AdminCreateProduct } from '@proteus/http-schemas/admin'
import { formOptions } from '@tanstack/form-core'
import type { AdminCreateProductResponse } from '#/api/generated/model'
import { useCreateProduct } from '#/features/products/api/products'
import { useUploadProductMedia } from '#/features/products/hooks/use-upload-product-media.ts'
import { resolveMediaPayload } from '#/features/products/media.ts'
import { useAppForm } from '#/lib/form-hook.ts'
import type { SubmitFormParams } from '#/types/form.ts'
import type { SubmitIntent } from '../components/create-product-form/constants'
import { type ProductFormValues, productFormSchema } from '../components/create-product-form/schemas'

export const productCreateFormOpts = formOptions({
  defaultValues: {
    details: { title: '', subtitle: '', handle: '', description: '' },
    organize: { discountable: true },
    attributes: {
      material: '',
      originCountry: '',
      hsCode: '',
      midCode: '',
      weight: null,
      length: null,
      height: null,
      width: null,
    },
    media: [],
  } satisfies ProductFormValues as ProductFormValues,
  onSubmitMeta: {} as SubmitIntent,
})

export type CreateProductFormParams = SubmitFormParams<AdminCreateProductResponse>

export function useCreateProductForm(params?: CreateProductFormParams) {
  const { uploadMedia, isPending: isUploading } = useUploadProductMedia()
  const createMutation = useCreateProduct()

  const form = useAppForm({
    ...productCreateFormOpts,
    validators: { onSubmit: productFormSchema },
    onSubmit: async ({ value, meta }) => {
      const status = meta?.intent === 'draft' ? 'draft' : 'published'

      try {
        // Staged files have to reach storage before the product can reference their URLs.
        const media = await uploadMedia(value.media)

        // Parsing rather than casting also drops the image ids, which only updates accept.
        const payload = AdminCreateProduct.parse({
          ...value.details,
          ...value.organize,
          ...value.attributes,
          ...resolveMediaPayload(media),
          status,
        })

        createMutation.mutate(payload, {
          onSuccess: (data) => {
            form.reset()
            params?.onSuccess?.(data)
          },
          onError: (error) => params?.onError?.(error.message),
          onSettled: () => params?.onSettled?.(),
        })
      } catch (error) {
        // The upload and the parse throw; `mutate` reports its own failures through the callbacks.
        params?.onError?.(error instanceof Error ? error.message : 'Failed to create product')
        params?.onSettled?.()
      }
    },
  })

  return { form, isLoading: isUploading || createMutation.isPending }
}
