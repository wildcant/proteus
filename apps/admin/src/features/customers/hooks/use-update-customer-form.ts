import { AdminUpdateCustomer, type AdminUpdateCustomerBody } from '@proteus/http-schemas/admin'
import type { AdminCustomerResponse } from '#/api/generated/model'
import { useUpdateCustomer } from '#/features/customers/api/customers'
import { useAppForm } from '#/lib/form-hook.ts'
import { errorMessage, type SubmitFormParams } from '#/types/form.ts'

export type UpdateCustomerFormParams = SubmitFormParams<AdminCustomerResponse> & {
  id: string
  defaultValues: AdminUpdateCustomerBody
}

export function useUpdateCustomerForm(params: UpdateCustomerFormParams) {
  const updateMutation = useUpdateCustomer()

  const form = useAppForm({
    defaultValues: params.defaultValues,
    validators: { onSubmit: AdminUpdateCustomer },
    onSubmit: async ({ value }) => {
      try {
        const data = await updateMutation.mutateAsync({ id: params.id, data: value })
        params.onSuccess?.(data)
      } catch (error) {
        params.onError?.(errorMessage(error))
      } finally {
        params.onSettled?.()
      }
    },
  })

  return { form }
}
