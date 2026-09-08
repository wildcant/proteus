import type { CartAddressInputBody, StoreCompleteCartResponse } from '@proteus/http-schemas/store'
import { formOptions } from '@tanstack/react-form'
import { useState } from 'react'
import { z } from 'zod'
import { useLogout } from '#/features/auth/api/auth'
import { useMarket } from '#/hooks/use-market'
import { errorMessage, type SubmitFormParams } from '#/lib/form'
import { useAppForm } from '#/lib/form-hook'
import { CheckoutAddress } from '../utils/checkout-address'
import { checkoutReturnUrl } from '../utils/payment/return-url'
import type { CheckoutData } from './use-checkout-data'
import { useCompleteOrder } from './use-complete-order'
import { usePlaceOrder } from './use-place-order'

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

export function useCheckoutForm(params: CheckoutFormParams) {
  const { completeOrder } = useCompleteOrder()
  const { controller, confirmPayment } = usePlaceOrder(params.data.cart.id)
  /**
   * What the gateway said, in the shopper's words. Held here rather than as a field error: it is
   * not about a field they can correct, and it has to survive the submit that produced it.
   */
  const [paymentError, setPaymentError] = useState<string | null>(null)
  // Stay in checkout rather than falling home. Signing out here almost always means "wrong
  // account", not "I'm done" — the cart survives the sign-out, so the order should too. Naming
  // the route rather than staying put also closes any address drawer, which a guest cannot reopen.
  const logout = useLogout({ redirectTo: '/checkout' })

  const { current } = useMarket()

  const { customer, addresses, cartAddresses } = params.data
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
      setPaymentError(null)
      try {
        const outcome = await confirmPayment({
          values: value,
          returnUrl: checkoutReturnUrl(value.paymentProviderId),
        })

        // The tab is on its way to the gateway. Anything done here would be done twice: the
        // return route picks the sequence up at cart completion.
        if (outcome.kind === 'redirecting') return

        // `processing` is a method that settles later. The order is created now and the webhook
        // reconciles the money, which is the deferred-authorization path the backend already has.
        if (outcome.kind !== 'succeeded' && outcome.kind !== 'processing') {
          setPaymentError(paymentFailureMessage(outcome))
          return
        }

        const response = await completeOrder()
        form.reset()
        params.onSuccess?.(response)
      } catch (error) {
        params.onError?.(errorMessage(error))
      } finally {
        params.onSettled?.()
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
    controller,
    paymentError,
  }
}

/**
 * The two non-success outcomes the checkout can be handed.
 *
 * `customerMessage` arrives already sanitised by the adapter that knows the gateway's error
 * vocabulary, so nothing here has to decide what is safe to print.
 */
function paymentFailureMessage(outcome: { kind: 'failed'; customerMessage: string } | { kind: 'staleMethod' }): string {
  if (outcome.kind === 'failed') return outcome.customerMessage
  // The selector has already refetched the wallet and dropped the selection back to the new-method
  // form by the time this renders — see `usePlaceOrder`. This is the half that says why.
  return 'That saved card is no longer available. Please choose another card or enter a new one.'
}

export type CheckoutForm = ReturnType<typeof useCheckoutForm>['form']
