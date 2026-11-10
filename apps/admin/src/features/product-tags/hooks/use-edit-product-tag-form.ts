import { AdminUpdateProductTag } from '@proteus/http-schemas/admin'
import type { z } from 'zod'
import type { AdminProductTag, AdminProductTagResponse } from '#/api/generated/model'
import { useUpdateProductTag } from '#/features/product-tags/api/product-tags'
import { useAppForm } from '#/lib/form-hook.ts'
import { errorMessage, type SubmitFormParams } from '#/types/form.ts'

/** Renames the Tag. Every product with it reads the new value. */
export function useEditProductTagForm(tag: AdminProductTag, params?: SubmitFormParams<AdminProductTagResponse>) {
  const updateMutation = useUpdateProductTag(tag.id)

  const defaultValues: z.input<typeof AdminUpdateProductTag> = { value: tag.value }

  const form = useAppForm({
    defaultValues,
    validators: { onSubmit: AdminUpdateProductTag },
    onSubmit: async ({ value }) => {
      try {
        const data = await updateMutation.mutateAsync(AdminUpdateProductTag.parse(value))
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
