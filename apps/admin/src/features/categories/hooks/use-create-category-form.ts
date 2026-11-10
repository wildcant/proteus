import { AdminCreateProductCategory } from '@proteus/http-schemas/admin'
import { z } from 'zod'
import type { AdminProductCategoryResponse } from '#/api/generated/model'
import { useCreateCategory } from '#/features/categories/api/categories'
import { useAppForm } from '#/lib/form-hook.ts'
import { errorMessage, type SubmitFormParams } from '#/types/form.ts'

/** A blank handle is left out so the server generates one from the name. */
const createCategorySchema = AdminCreateProductCategory.pick({ name: true, description: true }).extend({
  handle: z.string(),
  parentId: z.string().nullable(),
  isActive: z.boolean(),
  isInternal: z.boolean(),
})

export function useCreateCategoryForm(params?: SubmitFormParams<AdminProductCategoryResponse>) {
  const createMutation = useCreateCategory()

  const defaultValues: z.input<typeof createCategorySchema> = {
    name: '',
    handle: '',
    description: '',
    parentId: null,
    isActive: false,
    isInternal: false,
  }

  const form = useAppForm({
    defaultValues,
    validators: { onSubmit: createCategorySchema },
    onSubmit: async ({ value }) => {
      try {
        const { handle, ...category } = value
        const data = await createMutation.mutateAsync(
          AdminCreateProductCategory.parse({ ...category, handle: handle.trim() || undefined }),
        )
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
