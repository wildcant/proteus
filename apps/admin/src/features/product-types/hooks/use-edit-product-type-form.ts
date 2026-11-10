import { AdminUpdateProductType } from '@proteus/http-schemas/admin'
import type { z } from 'zod'
import type { AdminProductType, AdminProductTypeResponse } from '#/api/generated/model'
import { useUpdateProductType } from '#/features/product-types/api/product-types'
import { useAppForm } from '#/lib/form-hook.ts'
import { errorMessage, type SubmitFormParams } from '#/types/form.ts'

/** Renames the Type. Every product with it reads the new value; line items keep the old one. */
export function useEditProductTypeForm(type: AdminProductType, params?: SubmitFormParams<AdminProductTypeResponse>) {
  const updateMutation = useUpdateProductType(type.id)

  const defaultValues: z.input<typeof AdminUpdateProductType> = { value: type.value }

  const form = useAppForm({
    defaultValues,
    validators: { onSubmit: AdminUpdateProductType },
    onSubmit: async ({ value }) => {
      try {
        const data = await updateMutation.mutateAsync(AdminUpdateProductType.parse(value))
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
