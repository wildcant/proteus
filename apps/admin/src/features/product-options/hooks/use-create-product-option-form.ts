import { AdminCreateProductOption, type AdminCreateProductOptionBody } from '@proteus/http-schemas/admin'
import type { AdminProductOptionResponse } from '#/api/generated/model'
import { useCreateProductOption } from '#/features/product-options/api/product-options'
import { useAppForm } from '#/lib/form-hook.ts'
import type { SubmitFormParams } from '#/types/form.ts'

export type CreateProductOptionFormParams = SubmitFormParams<AdminProductOptionResponse>

export function useCreateProductOptionForm(params?: CreateProductOptionFormParams) {
  const createMutation = useCreateProductOption()

  const form = useAppForm({
    defaultValues: { title: '', values: [] } satisfies AdminCreateProductOptionBody as AdminCreateProductOptionBody,
    validators: { onSubmit: AdminCreateProductOption },
    onSubmit: ({ value }) => {
      createMutation.mutate(
        { title: value.title, values: value.values?.length ? value.values : undefined },
        {
          onSuccess: (data) => {
            form.reset()
            params?.onSuccess?.(data)
          },
          onError: (error) => params?.onError?.(error.message),
          onSettled: () => params?.onSettled?.(),
        },
      )
    },
  })

  return { form, isLoading: createMutation.isPending }
}
