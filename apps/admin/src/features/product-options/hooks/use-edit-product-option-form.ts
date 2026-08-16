import { z } from 'zod'
import type { AdminProductOption, AdminProductOptionResponse } from '#/api/generated/model'
import { useUpdateProductOption } from '#/features/product-options/api/product-options'
import { useAppForm } from '#/lib/form-hook.ts'
import type { SubmitFormParams } from '#/types/form.ts'

const updateOptionFormSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  values: z.array(z.string()),
})

type UpdateOptionFormValues = z.infer<typeof updateOptionFormSchema>

export type EditProductOptionFormParams = SubmitFormParams<AdminProductOptionResponse>

export function useEditProductOptionForm(option: AdminProductOption, params?: EditProductOptionFormParams) {
  const updateMutation = useUpdateProductOption(option.id)

  const form = useAppForm({
    defaultValues: {
      title: option.title,
      values: option.values.map((v) => v.value),
    } satisfies UpdateOptionFormValues as UpdateOptionFormValues,
    validators: { onSubmit: updateOptionFormSchema },
    onSubmit: async ({ value }) => {
      const values = value.values.map((v, rank) => ({ value: v, rank }))
      try {
        const data = await updateMutation.mutateAsync({
          title: value.title,
          values: values.length > 0 ? values : undefined,
        })
        form.reset()
        params?.onSuccess?.(data)
      } catch (error) {
        params?.onError?.(error instanceof Error ? error.message : 'An unexpected error occurred')
      } finally {
        params?.onSettled?.()
      }
    },
  })

  return { form, isLoading: updateMutation.isPending }
}
