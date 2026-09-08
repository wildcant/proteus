import { AdminSetProductOptions, type AdminSetProductOptionsBody } from '@proteus/http-schemas/admin'
import type { AdminSetProductOptionsResponse } from '#/api/generated/model'
import { useSetProductOptions } from '#/features/product-options/api/product-options'
import { useAppForm } from '#/lib/form-hook.ts'
import { errorMessage, type SubmitFormParams } from '#/types/form.ts'

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
    onSubmit: async ({ value }) => {
      try {
        const data = await mutation.mutateAsync(value)
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
