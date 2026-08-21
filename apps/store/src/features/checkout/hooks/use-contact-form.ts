import { UpdateCart } from '@proteus/http-schemas/store'
import { z } from 'zod'
import { useUpdateCart } from '#/features/checkout/api/checkout'
import type { SubmitFormParams } from '#/lib/form'
import { useAppForm } from '#/lib/form-hook'

const contactSchema = UpdateCart.pick({ firstName: true, lastName: true }).extend({
  email: z.email('Email is required'),
})

export type ContactFormValues = z.infer<typeof contactSchema>

const EMPTY_DEFAULTS: ContactFormValues = {
  email: '',
  firstName: '',
  lastName: '',
}

export type ContactFormParams = SubmitFormParams & {
  defaultValues?: ContactFormValues
}

export function useContactForm(params?: ContactFormParams) {
  const updateCart = useUpdateCart()

  const form = useAppForm({
    defaultValues: params?.defaultValues ?? EMPTY_DEFAULTS,
    validators: { onSubmit: contactSchema },
    onSubmit: async ({ value }) => {
      updateCart.mutate(value, {
        onSuccess: () => params?.onSuccess?.(),
        onError: (error) => params?.onError?.(error.message),
        onSettled: () => params?.onSettled?.(),
      })
    },
  })

  return { form, isPending: updateCart.isPending, error: updateCart.error }
}
