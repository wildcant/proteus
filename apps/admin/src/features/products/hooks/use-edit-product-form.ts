import { AdminUpdateProduct } from '@proteus/http-schemas/admin'
import type { AdminProduct, AdminUpdateProductResponse } from '#/api/generated/model'
import { useUpdateProduct } from '#/features/products/api/products'
import { useAppForm } from '#/lib/form-hook.ts'
import { errorMessage, type SubmitFormParams } from '#/types/form.ts'

export type EditProductFormParams = SubmitFormParams<AdminUpdateProductResponse>

export function useEditProductForm(product: AdminProduct, params?: EditProductFormParams) {
  const updateMutation = useUpdateProduct(product.id)

  const form = useAppForm({
    defaultValues: { title: product.title },
    validators: { onSubmit: AdminUpdateProduct.required({ title: true }) },
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
