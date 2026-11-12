import { AdminUpdateProductCategory, type AdminUpdateProductCategoryBody } from '@proteus/http-schemas/admin'
import type { AdminProductCategory, AdminProductCategoryResponse } from '#/api/generated/model'
import { useUpdateCategory } from '#/features/categories/api/categories'
import { useAppForm } from '#/lib/form-hook.ts'
import { errorMessage, type SubmitFormParams } from '#/types/form.ts'

/** The parent is fixed at creation; moving a Category is the Organize page's job, not this form's. */
export function useEditCategoryForm(
  category: AdminProductCategory,
  params?: SubmitFormParams<AdminProductCategoryResponse>,
) {
  const updateMutation = useUpdateCategory(category.id)

  const form = useAppForm({
    defaultValues: {
      name: category.name,
      handle: category.handle,
      description: category.description,
      isActive: category.isActive,
      isInternal: category.isInternal,
    } satisfies AdminUpdateProductCategoryBody as AdminUpdateProductCategoryBody,
    validators: { onSubmit: AdminUpdateProductCategory },
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
