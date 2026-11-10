import { AdminCreateProductTag } from '@proteus/http-schemas/admin'
import type { z } from 'zod'
import type { AdminProductTagResponse } from '#/api/generated/model'
import { useCreateProductTag } from '#/features/product-tags/api/product-tags'
import { useAppForm } from '#/lib/form-hook.ts'
import { errorMessage, type SubmitFormParams } from '#/types/form.ts'

export function useCreateProductTagForm(params?: SubmitFormParams<AdminProductTagResponse>) {
  const createMutation = useCreateProductTag()

  const defaultValues: z.input<typeof AdminCreateProductTag> = { value: '' }

  const form = useAppForm({
    defaultValues,
    validators: { onSubmit: AdminCreateProductTag },
    onSubmit: async ({ value }) => {
      try {
        const data = await createMutation.mutateAsync(AdminCreateProductTag.parse(value))
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
