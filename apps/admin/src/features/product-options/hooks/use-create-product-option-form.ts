import { AdminCreateProductOption, type AdminCreateProductOptionBody } from '@proteus/http-schemas/admin'
import type { AdminProductOptionResponse } from '#/api/generated/model'
import { useCreateProductOption } from '#/features/product-options/api/product-options'
import { useAppForm } from '#/lib/form-hook.ts'
import { errorMessage, type SubmitFormParams } from '#/types/form.ts'

export type CreateProductOptionFormParams = SubmitFormParams<AdminProductOptionResponse>

export function useCreateProductOptionForm(params?: CreateProductOptionFormParams) {
  const createMutation = useCreateProductOption()

  const form = useAppForm({
    defaultValues: { title: '', values: [] } satisfies AdminCreateProductOptionBody as AdminCreateProductOptionBody,
    validators: { onSubmit: AdminCreateProductOption },
    onSubmit: async ({ value }) => {
      try {
        const data = await createMutation.mutateAsync(value)
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
