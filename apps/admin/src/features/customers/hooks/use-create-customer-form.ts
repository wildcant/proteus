import { AdminCreateCustomer } from '@proteus/http-schemas/admin'
import type { AdminCreateCustomersResponse } from '#/api/generated/model'
import { useCreateCustomer } from '#/features/customers/api/customers'
import { useAppForm } from '#/lib/form-hook.ts'
import { errorMessage, type SubmitFormParams } from '#/types/form.ts'

export type CreateCustomerFormParams = SubmitFormParams<AdminCreateCustomersResponse>

export function useCreateCustomerForm(params?: CreateCustomerFormParams) {
  const createMutation = useCreateCustomer()

  const form = useAppForm({
    defaultValues: { firstName: '', lastName: '', email: '' },
    validators: { onSubmit: AdminCreateCustomer },
    onSubmit: async ({ value }) => {
      try {
        const data = await createMutation.mutateAsync([value])
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
