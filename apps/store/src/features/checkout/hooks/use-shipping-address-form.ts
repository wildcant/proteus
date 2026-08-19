import { CartAddressInput, UpdateCart } from '@proteus/http-schemas/store'
import { z } from 'zod'
import type { UpdateStoreCartBodyShippingAddress } from '#/api/generated/model'
import { useUpdateCart } from '#/features/checkout/api/checkout'
import type { SubmitFormParams } from '#/lib/form'
import { useAppForm } from '#/lib/form-hook'

const shippingAddressSchema = CartAddressInput.extend({ sameAsBilling: z.boolean() })

export type ShippingAddressFormValues = UpdateStoreCartBodyShippingAddress & { sameAsBilling: boolean }

const EMPTY_DEFAULTS = {
  firstName: 'John',
  lastName: 'Doe',
  address1: '123 Main St',
  address2: '',
  company: '',
  city: 'Austin',
  countryCode: 'us',
  province: 'TX',
  postalCode: '78701',
  phone: '5551234567',
  sameAsBilling: true,
} satisfies ShippingAddressFormValues as ShippingAddressFormValues

export type ShippingAddressFormParams = SubmitFormParams & {
  defaultValues?: ShippingAddressFormValues
}

export function useShippingAddressForm(params?: ShippingAddressFormParams) {
  const updateCart = useUpdateCart()

  const form = useAppForm({
    defaultValues: params?.defaultValues ?? EMPTY_DEFAULTS,
    validators: { onSubmit: shippingAddressSchema },
    onSubmit: async ({ value }) => {
      const payload = UpdateCart.parse({
        shippingAddress: value,
        billingAddress: value.sameAsBilling ? value : undefined,
      })

      updateCart.mutate(payload, {
        onSuccess: () => params?.onSuccess?.(),
        onError: (error) => params?.onError?.(error.message),
        onSettled: () => params?.onSettled?.(),
      })
    },
  })

  return { form, isPending: updateCart.isPending, error: updateCart.error }
}
