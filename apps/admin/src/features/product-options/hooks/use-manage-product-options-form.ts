import { AdminSetProductOptions, type AdminSetProductOptionsBody } from '@proteus/http-schemas/admin'
import type { AdminSetProductOptionsResponse } from '#/api/generated/model'
import { useSetProductOptions } from '#/features/product-options/api/product-options'
import { useAppForm } from '#/lib/form-hook.ts'
import type { SubmitFormParams } from '#/types/form.ts'

type ManageProductOptionsFormValues = AdminSetProductOptionsBody

export type ManageProductOptionsFormParams = SubmitFormParams<AdminSetProductOptionsResponse>

type UseManageProductOptionsFormArgs = {
  productId: string
  defaultValues: ManageProductOptionsFormValues
  params?: ManageProductOptionsFormParams
}

export function useManageProductOptionsForm({ productId, defaultValues, params }: UseManageProductOptionsFormArgs) {
  const mutation = useSetProductOptions(productId)

  const form = useAppForm({
    defaultValues,
    validators: { onSubmit: AdminSetProductOptions },
    onSubmit: ({ value }) => {
      mutation.mutate(value, {
        onSuccess: (data) => {
          form.reset()
          params?.onSuccess?.(data)
        },
        onError: (error) => params?.onError?.(error.message),
        onSettled: () => params?.onSettled?.(),
      })
    },
  })

  return { form, isLoading: mutation.isPending }
}
