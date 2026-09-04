import type { CartAddressInputBody, StoreCompleteCartResponse } from '@proteus/http-schemas/store'
import { formOptions } from '@tanstack/react-form'
import { useNavigate } from '@tanstack/react-router'
import { z } from 'zod'
import { useLogout } from '#/features/auth/api/auth'
import type { SubmitFormParams } from '#/lib/form'
import { useAppForm } from '#/lib/form-hook'
import { useMarket } from '#/lib/use-market'
import { useCompleteCart, useUpdateCart } from '../api/checkout'
import { CheckoutAddress } from '../checkout-address'
import type { CheckoutData } from './use-checkout-data'

const checkoutSchema = z.object({
  email: z.email('Email is required'),
  /**
   * The address is raised a second time as one issue at its own path. Every issue the schema
   * produces belongs to a single line — `shippingAddress.city` and friends — which is what the
   * address form renders; the picker has no per-line inputs to hang them under, so it needs the
   * address to fail as one thing.
   */
  shippingAddress: CheckoutAddress.check((ctx) => {
    if (ctx.issues.length === 0) return
    ctx.issues.push({ code: 'custom', message: 'Select a shipping address', input: ctx.value })
  }),
  billingAddress: CheckoutAddress,
  billingSameAsShipping: z.boolean(),
  // The selection is held as an id, not the option itself: nothing downstream reads more than the
  // id, and a radio group that compares strings cannot go stale when a refetch rebuilds the list.
  shippingOptionId: z.string().min(1, 'Select a shipping method'),
  paymentProviderId: z.string().min(1, 'Select a payment method'),
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

// Annotated rather than `satisfies`, which would infer `billingSameAsShipping` as the literal `true`
// and make every form typed from these options incompatible with the schema's `boolean`.
const DEFAULT_VALUES: CheckoutFormValues = {
  email: '',
  shippingAddress: EMPTY_ADDRESS,
  billingSameAsShipping: true,
  billingAddress: EMPTY_ADDRESS,
  shippingOptionId: '',
  paymentProviderId: '',
}

export const checkoutFormOpts = formOptions({ defaultValues: DEFAULT_VALUES })

/**
 * A blank delivery address, except for the one line of it the shopper does not fill in: the
 * market decides where the parcel goes, so the country is already answered on an empty form.
 *
 * Exported because the picker resets to this too — an address deleted mid-checkout has to leave
 * behind the same empty form a shopper who never had one starts from, country included.
 */
export function emptyShippingAddress(iso2: string): CheckoutFormValues['shippingAddress'] {
  return { ...EMPTY_ADDRESS, countryCode: iso2 }
}

type CheckoutFormParams = SubmitFormParams<StoreCompleteCartResponse> & {
  data: CheckoutData
}

export function useCheckoutForm(params?: CheckoutFormParams) {
  const navigate = useNavigate()
  const updateCart = useUpdateCart()
  const completeCart = useCompleteCart()
  // Stay in checkout rather than falling home. Signing out here almost always means "wrong
  // account", not "I'm done" — the cart survives the sign-out, so the order should too. Naming
  // the route rather than staying put also closes any address drawer, which a guest cannot reopen.
  const logout = useLogout({ redirectTo: '/checkout' })

  const { current } = useMarket()

  const { customer, addresses, cartAddresses } = params?.data ?? {}
  // `addresses` is already narrowed to what this market delivers to, so the default picked here
  // cannot be one the shopper would be refused at the end.
  const billingAddress = addresses?.find((address) => address.isDefaultShipping)
  const defaultBillingAddress = billingAddress ? cartAddresses?.get(billingAddress.id) : null
  const defaultValues: CheckoutFormValues = {
    ...checkoutFormOpts.defaultValues,
    email: customer?.email ?? checkoutFormOpts.defaultValues.email,
    shippingAddress: defaultBillingAddress ? defaultBillingAddress : emptyShippingAddress(current.iso2),
  }

  const form = useAppForm({
    defaultValues,
    validators: { onSubmit: checkoutSchema },
    onSubmit: async ({ value }) => {
      try {
        await updateCart.mutateAsync({
          billingAddress: value.billingAddress,
          shippingAddress: value.shippingAddress,
          email: value.email,
        })
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

  /**
   * Sign-out leaves this form mounted, still holding the previous shopper's values. A bare
   * `reset()` would restore the mount defaults, which were built from that customer.
   */
  const signOut = () => {
    form.reset({ ...checkoutFormOpts.defaultValues, shippingAddress: emptyShippingAddress(current.iso2) })
    logout()
  }

  const placeOrder = () => {
    if (form.state.values.billingSameAsShipping) {
      form.setFieldValue('billingAddress', form.state.values.shippingAddress)
    }

    form.validate('submit')
    form.handleSubmit()
  }

  return {
    form,
    placeOrder,
    signOut,
    isLoading: completeCart.isPending || updateCart.isPending,
    /**
     * Whether the last attempt to place this order failed. The payment step offers to reopen the
     * session on the strength of it: the completion guard refuses a session whose amount or
     * currency no longer matches the cart, and a market switch is what puts them out of step.
     */
    hasFailedOrder: completeCart.isError,
  }
}

export type CheckoutForm = ReturnType<typeof useCheckoutForm>['form']
