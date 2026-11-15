import { AdminUpdateCustomer, type AdminUpdateCustomerBody } from '@proteus/http-schemas/admin'
import { z } from 'zod'
import type { AdminCustomerResponse } from '#/api/generated/model'
import { useUpdateCustomer } from '#/features/customers/api/customers'
import { useAppForm } from '#/lib/form-hook.ts'
import { errorMessage, type SubmitFormParams } from '#/types/form.ts'

/** The form's fields as text: a guest may have no email or no phone, and its field starts empty. */
type UpdateCustomerFormValues = {
  firstName: string
  lastName: string
  email: string
  phone: string
}

const fields = AdminUpdateCustomer.shape
const updateCustomerFormSchema = z.object({
  firstName: z.union([z.literal(''), fields.firstName.unwrap().unwrap()]),
  lastName: z.union([z.literal(''), fields.lastName.unwrap().unwrap()]),
  email: z.union([z.literal(''), fields.email.unwrap().unwrap()]),
  phone: fields.phone.unwrap().unwrap(),
})

/** An empty field clears it, so a guest can lose a mistyped email or phone. */
const toUpdateCustomerBody = (value: UpdateCustomerFormValues): AdminUpdateCustomerBody => ({
  firstName: value.firstName || null,
  lastName: value.lastName || null,
  email: value.email || null,
  phone: value.phone || null,
})

export type UpdateCustomerFormParams = SubmitFormParams<AdminCustomerResponse> & {
  id: string
  defaultValues: UpdateCustomerFormValues
}

export function useUpdateCustomerForm(params: UpdateCustomerFormParams) {
  const updateMutation = useUpdateCustomer()

  const form = useAppForm({
    defaultValues: params.defaultValues,
    validators: { onSubmit: updateCustomerFormSchema },
    onSubmit: async ({ value }) => {
      try {
        const data = await updateMutation.mutateAsync({ id: params.id, data: toUpdateCustomerBody(value) })
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
