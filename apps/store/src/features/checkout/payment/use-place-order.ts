import type { CartAddressInputBody } from '@proteus/http-schemas/store'
import { useCallback } from 'react'
import { useUpdateCart } from '../api/checkout'
import { usePaymentController } from './payment-controller'
import { resolvePaymentAdapter } from './registry'
import type { ConfirmOutcome } from './types'
import { useOpenPaymentSession } from './use-payment-session'

/**
 * The submit sequence, and the reason the payment step is deferred at all.
 *
 * 1. The shopper presses **Place order**. Nothing exists at any gateway yet.
 * 2. The adapter validates locally — for Stripe, `elements.submit()`. A mistyped card stops here
 *    and no request leaves the browser.
 * 3. `createSession` commits the cart and opens the session. The server prices the cart; the
 *    browser sends no amount. This is the press that creates the PaymentIntent.
 * 4. The adapter confirms, and answers in the checkout's vocabulary rather than the gateway's.
 * 5. The caller completes the cart, which authorizes the session and creates the order.
 *
 * Steps 2 and 4 belong to the adapter and steps 3 and 5 to the checkout, which is what makes
 * deferred creation a property of the checkout rather than a promise each adapter has to keep.
 */
/**
 * What the sequence needs off the form, named here rather than imported from it.
 *
 * The checkout form depends on this hook, so this hook must not depend on the form — and the
 * narrower shape is honest anyway: the payment step reads four of its fields and no others.
 */
export type PlaceOrderValues = {
  paymentProviderId: string
  email: string
  shippingAddress: CartAddressInputBody
  billingAddress: CartAddressInputBody
}

export type PlaceOrderArgs = {
  values: PlaceOrderValues
  returnUrl: string
}

export function usePlaceOrder(cartId: string) {
  const controller = usePaymentController()
  const updateCart = useUpdateCart()
  const { open, isPending: isOpeningSession } = useOpenPaymentSession(cartId)

  const confirmPayment = useCallback(
    async ({ values, returnUrl }: PlaceOrderArgs): Promise<ConfirmOutcome> => {
      const openSession = open(values.paymentProviderId)

      /**
       * The shopper's last write to the cart goes inside session creation rather than before it,
       * and that ordering is the whole of "a local validation error never reaches our server":
       * the adapter validates first, and only a card that could be charged causes us to write
       * anything. It also means the total the server prices is the one behind the addresses the
       * shopper just confirmed.
       */
      const createSession = async (providerData?: Record<string, unknown>) => {
        await updateCart.mutateAsync({
          billingAddress: values.billingAddress,
          shippingAddress: values.shippingAddress,
          email: values.email,
        })
        return openSession(providerData)
      }

      const adapter = resolvePaymentAdapter(values.paymentProviderId)
      if (!adapter) {
        // A provider with no client adapter takes no details and has nothing to confirm — the
        // system provider is the one in the box. Open the session and let the cart complete.
        await createSession()
        return { kind: 'succeeded', reference: values.paymentProviderId }
      }

      const confirm = controller.current()
      if (!confirm) {
        // The adapter's form has not mounted, so there is nothing to charge. Refusing beats
        // opening a session that no confirmation will ever follow.
        return { kind: 'failed', customerMessage: 'The payment form is still loading. Please try again.' }
      }

      // What the shopper decided in the selector, read at the press rather than held in the form:
      // nothing in the checkout schema needs to know a card id, and a field for one would be a
      // second place the list has to be kept in step with.
      const wallet = controller.wallet()

      const outcome = await confirm({
        chosenMethodId: wallet?.chosenMethodId ?? null,
        saveMethod: wallet?.saveMethod ?? false,
        createSession,
        returnUrl,
        contact: { email: values.email, phone: values.shippingAddress.phone || null },
      })

      // The card they picked is gone, or was never theirs. Refetch the wallet and put them back
      // on the new-method form: offering them the same dead card to press again is the worst of
      // the options. The message beside the button is the checkout form's.
      if (outcome.kind === 'staleMethod') wallet?.resetForStaleMethod()

      return outcome
    },
    [controller, open, updateCart],
  )

  return { controller, confirmPayment, isPaying: updateCart.isPending || isOpeningSession }
}
