import { UpdateCart } from '@proteus/http-schemas/store'
import { z } from 'zod'
import { PREFILL_FORMS } from '#/env.ts'
import { useUpdateCart } from '#/features/checkout/api/checkout'
import type { SubmitFormParams } from '#/lib/form'
import { useAppForm } from '#/lib/form-hook'

const shippingAddressSchema = UpdateCart.pick({ shippingAddress: true, billingAddress: true })
  .required()
  .extend({ sameAsBilling: z.boolean() })

export type ShippingAddressFormValues = z.infer<typeof shippingAddressSchema>

const EMPTY_ADDRESS: ShippingAddressFormValues['shippingAddress'] = {
  firstName: '',
  lastName: '',
  address1: '',
  address2: '',
  company: '',
  city: '',
  countryCode: '',
  province: '',
  postalCode: '',
  phone: '',
}

const TEST_ADDRESS: ShippingAddressFormValues['shippingAddress'] = {
  firstName: 'Joe',
  lastName: 'Doe',
  address1: '123 Main St',
  address2: '',
  company: '',
  city: 'Austin',
  countryCode: 'us',
  province: 'TX',
  postalCode: '78701',
  phone: '5551234567',
}

const EMPTY_DEFAULTS: ShippingAddressFormValues = {
  sameAsBilling: true,
  shippingAddress: EMPTY_ADDRESS,
  billingAddress: EMPTY_ADDRESS,
}

const TEST_DEFAULTS: ShippingAddressFormValues = {
  sameAsBilling: true,
  shippingAddress: TEST_ADDRESS,
  billingAddress: TEST_ADDRESS,
}

export type ShippingAddressFormParams = SubmitFormParams & {
  defaultValues?: ShippingAddressFormValues
}

export function useShippingAddressForm(params?: ShippingAddressFormParams) {
  const updateCart = useUpdateCart()

  const form = useAppForm({
    defaultValues: params?.defaultValues ?? (PREFILL_FORMS ? TEST_DEFAULTS : EMPTY_DEFAULTS),
    validators: { onSubmit: shippingAddressSchema },
    onSubmit: async ({ value }) => {
      updateCart.mutate(
        {
          shippingAddress: value.shippingAddress,
          billingAddress: value.billingAddress,
        },
        {
          onSuccess: () => params?.onSuccess?.(),
          onError: (error) => params?.onError?.(error.message),
          onSettled: () => params?.onSettled?.(),
        },
      )
    },
  })

  return { form, isPending: updateCart.isPending, error: updateCart.error }
}
