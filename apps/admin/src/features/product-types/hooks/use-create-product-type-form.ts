import { AdminCreateProductType } from '@proteus/http-schemas/admin'
import type { z } from 'zod'
import type { AdminProductTypeResponse } from '#/api/generated/model'
import { useCreateProductType } from '#/features/product-types/api/product-types'
import { useAppForm } from '#/lib/form-hook.ts'
import { errorMessage, type SubmitFormParams } from '#/types/form.ts'

export function useCreateProductTypeForm(params?: SubmitFormParams<AdminProductTypeResponse>) {
  const createMutation = useCreateProductType()

  const defaultValues: z.input<typeof AdminCreateProductType> = { value: '' }

  const form = useAppForm({
    defaultValues,
    validators: { onSubmit: AdminCreateProductType },
    onSubmit: async ({ value }) => {
      try {
        const data = await createMutation.mutateAsync(AdminCreateProductType.parse(value))
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
