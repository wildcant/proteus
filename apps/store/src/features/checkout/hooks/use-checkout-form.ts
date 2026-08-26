import {
  CartAddressInput,
  type CartAddressInputBody,
  type StoreCompleteCartResponse,
  StorePaymentProvider,
  StoreShippingOption,
} from '@proteus/http-schemas/store'
import { formOptions } from '@tanstack/react-form'
import { useNavigate } from '@tanstack/react-router'
import { z } from 'zod'
import type { Customer, StoreCustomerAddress } from '#/api/generated/model'
import type { SubmitFormParams } from '#/lib/form'
import { useAppForm } from '#/lib/form-hook'
import { useCompleteCart, useUpdateCart } from '../api/checkout'
import type { CheckoutData } from './use-checkout-data'

const checkoutSchema = z.object({
  email: z.email('Email is required'),
  shippingAddress: CartAddressInput,
  billingAddress: CartAddressInput,
  billingSameAsShipping: z.boolean(),
  shippingOption: StoreShippingOption,
  paymentProvider: StorePaymentProvider,
})

const EMPTY_ADDRESS: CartAddressInputBody = {
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

export type CheckoutFormValues = z.infer<typeof checkoutSchema>

export const checkoutFormOpts = formOptions({
  defaultValues: {
    email: '',
    shippingAddress: EMPTY_ADDRESS,
    billingSameAsShipping: true,
    billingAddress: EMPTY_ADDRESS,
    // default value is null to make sure validation on radio group works properly.
    shippingOption: null as unknown as StoreShippingOption,
    paymentProvider: null as unknown as StorePaymentProvider,
  } satisfies CheckoutFormValues as CheckoutFormValues,
})

type CheckoutFormParams = SubmitFormParams<StoreCompleteCartResponse> & {
  data: CheckoutData
}

// TODO(address): Fix customer address make properties required address1, city, countryCode, postalCode.
export function toCartAddressInput({ id, ...address }: StoreCustomerAddress, customer: Customer): CartAddressInputBody {
  return {
    ...address,
    firstName: address.firstName ?? customer.firstName,
    lastName: address.lastName ?? customer.lastName,
    address1: address.address1 ?? '',
    city: address.city ?? '',
    countryCode: address.countryCode ?? '',
    postalCode: address.postalCode ?? '',
  }
}

export function useCheckoutForm(params?: CheckoutFormParams) {
  const navigate = useNavigate()
  const updateCart = useUpdateCart()
  const completeCart = useCompleteCart()

  const { customer, addresses } = params?.data ?? {}
  const billingAddress = addresses?.find((address) => address.isDefaultShipping)
  const defaultValues: CheckoutFormValues = {
    ...checkoutFormOpts.defaultValues,
    email: customer?.email ?? checkoutFormOpts.defaultValues.email,
    shippingAddress:
      customer && billingAddress
        ? toCartAddressInput(billingAddress, customer)
        : checkoutFormOpts.defaultValues.shippingAddress,
  }

  const form = useAppForm({
    defaultValues,
    validators: { onSubmit: checkoutSchema },
    onSubmit: async ({ value }) => {
      try {
        await updateCart.mutateAsync({ billingAddress: value.billingAddress })
        const response = await completeCart.mutateAsync()
        form.reset()
        params?.onSuccess?.(response)
        navigate({ to: '/order/$orderId/confirmed', params: { orderId: response.orderId } })
      } catch (error) {
        params?.onError?.(error instanceof Error ? error.message : 'Failed to place the order')
      } finally {
        params?.onSettled?.()
      }
    },
  })

  const placeOrder = () => {
    if (form.state.values.billingSameAsShipping) {
      form.setFieldValue('billingAddress', form.state.values.shippingAddress)
    }

    form.handleSubmit()
  }

  return { form, placeOrder, isLoading: completeCart.isPending || updateCart.isPending }
}

export type CheckoutForm = ReturnType<typeof useCheckoutForm>['form']
