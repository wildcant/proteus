import { AdminUpdateProductOption, type AdminUpdateProductOptionBody } from '@proteus/http-schemas/admin'
import type { AdminProductOption, AdminProductOptionResponse } from '#/api/generated/model'
import { useUpdateProductOption } from '#/features/product-options/api/product-options'
import { useAppForm } from '#/lib/form-hook.ts'
import type { SubmitFormParams } from '#/types/form.ts'

export type EditProductOptionFormParams = SubmitFormParams<AdminProductOptionResponse>

export function useEditProductOptionForm(option: AdminProductOption, params?: EditProductOptionFormParams) {
  const updateMutation = useUpdateProductOption(option.id)

  const form = useAppForm({
    defaultValues: {
      title: option.title,
      values: option.values.map((v) => ({ value: v.value, rank: v.rank ?? undefined })),
    } satisfies AdminUpdateProductOptionBody as AdminUpdateProductOptionBody,
    validators: { onSubmit: AdminUpdateProductOption },
    onSubmit: async ({ value }) => {
      try {
        const data = await updateMutation.mutateAsync({
          title: value.title,
          values: value.values?.length ? value.values : undefined,
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
