import { Elements, PaymentElement, useElements, useStripe } from '@stripe/react-stripe-js'
import { loadStripe, type PaymentIntent, type Stripe, type StripeElementsOptions } from '@stripe/stripe-js'
import { useCallback, useMemo } from 'react'
import { logPaymentFailure } from '../../log'
import type { Confirm, ConfirmOutcome, PaymentAdapterContext, StorePaymentAdapter } from '../../types'
import { appearanceFor, useThemeTokens } from './appearance'
import { customerMessageForStripeError, GENERIC_FAILURE_MESSAGE, logFieldsForStripeError } from './errors'
import { toSmallestUnit } from './smallest-unit'

/**
 * The Stripe client adapter. Every Stripe symbol in the storefront lives under this directory, and
 * `stripe-stays-in-its-adapter` in `deps-analyzer/.dependency-cruiser.cjs` fails the build if one
 * escapes — so "the checkout depends on an adapter, not on Stripe" is enforced rather than hoped.
 */

/**
 * Stripe.js is a single script per key, so the promise is cached at module scope: `loadStripe`
 * injects a `<script>` on first call, and remounting the payment step must not queue another.
 */
const stripeByKey = new Map<string, Promise<Stripe | null>>()

function stripeFor(publishableKey: string): Promise<Stripe | null> {
  const existing = stripeByKey.get(publishableKey)
  if (existing) return existing

  const loading = loadStripe(publishableKey)
  stripeByKey.set(publishableKey, loading)
  return loading
}

function publishableKeyOf(publicConfig: Record<string, unknown>): string {
  const key = publicConfig.publishableKey
  if (typeof key !== 'string' || key === '') {
    // A deployment that got this far without a key would otherwise show an empty payment step and
    // no reason for it. The backend refuses to boot without one, so this is the storefront's half.
    throw new Error('Stripe is enabled but GET /store/payment-providers served no publishableKey')
  }
  return key
}

/**
 * The intent's own state, in the checkout's vocabulary.
 *
 * `requires_capture` is the success case here, not an oddity: the backend creates every intent
 * with `capture_method: 'manual'`, so a confirmed card lands there and `completeCart` authorizes
 * it. `processing` is a method that will settle later — the order is placed and the webhook
 * reconciles it.
 */
function outcomeForIntent(intent: PaymentIntent): ConfirmOutcome {
  if (intent.status === 'requires_capture' || intent.status === 'succeeded') {
    return { kind: 'succeeded', reference: intent.id }
  }
  if (intent.status === 'processing') return { kind: 'processing', reference: intent.id }

  // requires_payment_method, requires_confirmation, requires_action, canceled. The shopper did not
  // pay, and `last_payment_error` is the only thing that can say why in their own terms.
  return { kind: 'failed', customerMessage: customerMessageForStripeError(intent.last_payment_error) }
}

function StripeRoot({ context, children }: { context: PaymentAdapterContext; children: React.ReactNode }) {
  const publishableKey = publishableKeyOf(context.publicConfig)
  const stripe = useMemo(() => stripeFor(publishableKey), [publishableKey])
  const tokens = useThemeTokens()

  /**
   * Deferred mode: `mode: 'payment'` with an amount and a currency, and **no client secret**.
   * That is what lets the intent be created at submit rather than on arrival, and it is the
   * largest structural difference from the Medusa storefront, whose wrapper cannot mount until a
   * session exists.
   *
   * `captureMethod` has to match the intent the backend opens or Stripe.js refuses the
   * confirmation. The amount is a display and eligibility input only — what is charged is priced
   * server-side, and `useConfirm` updates this figure to the server's before confirming.
   */
  const options = useMemo<StripeElementsOptions>(
    () => ({
      mode: 'payment',
      amount: toSmallestUnit(context.amount, context.currencyCode),
      currency: context.currencyCode.toLowerCase(),
      captureMethod: 'manual',
      appearance: tokens ? appearanceFor(tokens) : undefined,
    }),
    [context.amount, context.currencyCode, tokens],
  )

  // Nothing renders until the tokens are read: mounting with the default appearance and restyling
  // a frame later is a visible flash of Stripe's own blue on a store that has no blue in it.
  if (!tokens) return null

  return (
    <Elements stripe={stripe} options={options}>
      {children}
    </Elements>
  )
}

/**
 * The card form.
 *
 * `fields.billingDetails.address: 'if_required'` and `name: 'auto'` are the spec's field
 * configuration: the checkout already collected an address and must not re-ask for it, and the
 * name on the card is worth having. Email and phone are `'never'` because the checkout has them,
 * and `useConfirm` supplies them at confirmation — the only fields it is allowed to supply.
 *
 * `wallets.link: 'never'`: Link, Apple Pay and Google Pay are the express-checkout surface, which
 * is separate work.
 */
function StripeNewMethodForm(_props: { canSaveMethod: boolean }) {
  // `canSaveMethod` is part of the port and is unused here on purpose. Saving a card needs an
  // Account Holder, which nothing creates yet; ILLO-24 owns the consent control and what it means.
  return (
    <PaymentElement
      options={{
        layout: { type: 'accordion', defaultCollapsed: false, radios: 'always', spacedAccordionItems: true },
        fields: { billingDetails: { name: 'auto', email: 'never', phone: 'never', address: 'if_required' } },
        wallets: { link: 'never', applePay: 'never', googlePay: 'never' },
        terms: { card: 'never' },
      }}
    />
  )
}

function useStripeConfirm(): Confirm {
  const stripe = useStripe()
  const elements = useElements()

  return useCallback(
    async ({ createSession, returnUrl, contact }) => {
      if (!stripe || !elements) return { kind: 'failed', customerMessage: GENERIC_FAILURE_MESSAGE }

      // Step one, and before anything of ours: a card the shopper mistyped is caught here and no
      // request leaves the browser, so an abandoned checkout leaves nothing behind at all.
      const { error: submitError } = await elements.submit()
      if (submitError) return { kind: 'failed', customerMessage: customerMessageForStripeError(submitError) }

      // Step two: the session is opened now — this is the press that creates the PaymentIntent.
      const opened = await createSession()
      const clientSecret = opened.data.clientSecret
      if (typeof clientSecret !== 'string') {
        throw new Error('The payment session carries no clientSecret, so there is nothing to confirm against')
      }

      // The server priced the cart; Stripe.js refuses a confirmation whose Elements amount
      // disagrees with the intent's, and the cart may well have changed since this form mounted.
      await elements.update({
        amount: toSmallestUnit(opened.amount, opened.currencyCode),
        currency: opened.currencyCode.toLowerCase(),
      })

      const { error, paymentIntent } = await stripe.confirmPayment({
        elements,
        clientSecret,
        // `if_required` keeps a card in place and sends a redirect method away. Both paths end at
        // the same component — see the checkout return route.
        redirect: 'if_required',
        confirmParams: {
          // biome-ignore lint/style/useNamingConvention: Stripe SDK parameter
          return_url: returnUrl,
          // biome-ignore lint/style/useNamingConvention: Stripe SDK parameter
          payment_method_data: {
            // A field the Payment Element is told never to collect must be supplied here instead.
            // These two are exactly the fields the checkout already has, which is why they are
            // `'never'` rather than asked for a second time inside the card panel.
            // biome-ignore lint/style/useNamingConvention: Stripe SDK parameter
            billing_details: { email: contact.email, phone: contact.phone },
          },
        },
      })

      if (error) {
        // Everything the shopper is not told. `lost_card` and `generic_decline` read identically
        // on screen and are distinguishable here, which is the whole point of the split.
        logPaymentFailure('Stripe confirmation failed', logFieldsForStripeError(error))
        return { kind: 'failed', customerMessage: customerMessageForStripeError(error) }
      }

      // Unreachable on a redirect: the tab has already left. Answered anyway, because a Stripe.js
      // that resolves without either an error or an intent must not read as success.
      if (!paymentIntent) return { kind: 'redirecting' }

      return outcomeForIntent(paymentIntent)
    },
    [stripe, elements],
  )
}

/**
 * The other half of `redirect: 'if_required'`.
 *
 * Which branch a shopper takes is a property of their country rather than their order, so this
 * path has to be real code with a real test — it is the one that rots while every local test
 * passes.
 */
function useStripeResumeRedirect() {
  const stripe = useStripe()

  const resume = useCallback(
    async (query: URLSearchParams): Promise<ConfirmOutcome> => {
      const clientSecret = query.get('payment_intent_client_secret')
      if (!stripe || !clientSecret) return { kind: 'failed', customerMessage: GENERIC_FAILURE_MESSAGE }

      const { paymentIntent, error } = await stripe.retrievePaymentIntent(clientSecret)
      if (error || !paymentIntent) {
        logPaymentFailure('Stripe return could not be resolved', logFieldsForStripeError(error))
        return { kind: 'failed', customerMessage: customerMessageForStripeError(error) }
      }

      return outcomeForIntent(paymentIntent)
    },
    [stripe],
  )

  // `null` until Stripe.js has loaded. The return route mounts and runs immediately, and answering
  // "we could not resume" one frame before the SDK arrives would strand a shopper who has paid.
  return stripe ? resume : null
}

export const stripeAdapter: StorePaymentAdapter = {
  id: 'stripe',
  Root: StripeRoot,
  NewMethodForm: StripeNewMethodForm,
  useConfirm: useStripeConfirm,
  useResumeRedirect: useStripeResumeRedirect,
}
