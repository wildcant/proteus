import { Elements, PaymentElement, useElements, useStripe } from '@stripe/react-stripe-js'
import { loadStripe, type PaymentIntent, type Stripe, type StripeElementsOptions } from '@stripe/stripe-js'
import { useCallback, useMemo } from 'react'
import { useWallet } from '#/features/account/api/payment-methods'
import type { Confirm, ConfirmOutcome, PaymentAdapterContext, StorePaymentAdapter } from '../../../../types/payment'
import { logPaymentFailure } from '../../log'
import { isStaleMethodError } from '../../session-errors'
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
 *
 * It writes the log line for a failure rather than only returning one, and that is deliberate:
 * this is where **both** paths converge on a terminal intent. A decline reached through
 * `confirmPayment`'s error and a decline read back off the intent after a redirect are the same
 * event to a shopper and to on-call, and logging at each call site left the redirect leg — the
 * one no local card can reach — writing nothing at all.
 */
function outcomeForIntent(intent: PaymentIntent, source: string): ConfirmOutcome {
  if (intent.status === 'requires_capture' || intent.status === 'succeeded') {
    return { kind: 'succeeded', reference: intent.id }
  }
  if (intent.status === 'processing') return { kind: 'processing', reference: intent.id }

  // requires_payment_method, requires_confirmation, requires_action, canceled. The shopper did not
  // pay, and `last_payment_error` is the only thing that can say why in their own terms.
  const failure = intent.last_payment_error
  logPaymentFailure(source, { ...logFieldsForStripeError(failure), intentStatus: intent.status, intent: intent.id })
  return { kind: 'failed', customerMessage: customerMessageForStripeError(failure) }
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
  // `canSaveMethod` is part of the port and is unused here on purpose: this gateway draws no
  // consent control of its own, so the selector renders one inside the panel — see
  // `SaveMethodConsent`. An adapter whose SDK draws its own would read the flag here instead.
  return (
    <PaymentElement
      options={{
        // Unspaced, because the store's list is one ruled stack rather than a column of cards:
        // spacing here left the gateway's rows floating inside a list whose own rows are flush.
        layout: { type: 'accordion', defaultCollapsed: false, radios: 'always', spacedAccordionItems: false },
        fields: { billingDetails: { name: 'auto', email: 'never', phone: 'never', address: 'if_required' } },
        wallets: { link: 'never', applePay: 'never', googlePay: 'never' },
        terms: { card: 'never' },
      }}
    />
  )
}

/**
 * The confirmation, in two flows that end at the same place.
 *
 * What they must agree on lives outside the branch: both open the session through the injected
 * `createSession`, both answer through `outcomeForIntent`, and both classify a failure through
 * the same sanitising rules. What differs is only what genuinely differs — a new card is in the
 * Element and has to be validated and submitted from it; a saved card is already at the gateway
 * and this is the id of it, so there is nothing on this page to validate and no Elements group to
 * confirm from. The reference implementation had these as two functions that quietly drifted, and
 * one of them ended up reading a raw gateway string out to a shopper.
 */
function useStripeConfirm(): Confirm {
  const stripe = useStripe()
  const elements = useElements()

  return useCallback(
    async ({ chosenMethodId, saveMethod, createSession, returnUrl, contact }) => {
      if (!stripe || !elements) return { kind: 'failed', customerMessage: GENERIC_FAILURE_MESSAGE }

      // Step one, and before anything of ours: a card the shopper mistyped is caught here and no
      // request leaves the browser, so an abandoned checkout leaves nothing behind at all. A saved
      // card skips it — the Element is unmounted, and there is nothing to validate.
      if (!chosenMethodId) {
        const { error: submitError } = await elements.submit()
        if (submitError) return { kind: 'failed', customerMessage: customerMessageForStripeError(submitError) }
      }

      // Step two: the session is opened now — this is the press that creates the PaymentIntent.
      // The two wallet facts travel in the provider data blob, which the route reads and the
      // server acts on; neither is trusted past its shape, and the account holder they act against
      // is resolved from the session's own authentication rather than from anything sent here.
      const opened = await createSession({
        savePaymentMethod: saveMethod,
        ...(chosenMethodId ? { paymentMethodId: chosenMethodId } : {}),
      }).catch((error: unknown) => {
        // The card is gone or was never theirs. The selector refetches and resets; nothing here
        // knows the API's code for it, because `createSession` is the checkout's and so is that.
        if (isStaleMethodError(error)) return null
        throw error
      })
      if (!opened) return { kind: 'staleMethod' }

      const clientSecret = opened.data.clientSecret
      if (typeof clientSecret !== 'string') {
        throw new Error('The payment session carries no clientSecret, so there is nothing to confirm against')
      }

      const { error, paymentIntent } = chosenMethodId
        ? await stripe.confirmPayment({
            clientSecret,
            // No `elements` here: the card is already at the gateway and this is the id of it.
            redirect: 'if_required',
            // biome-ignore lint/style/useNamingConvention: Stripe SDK parameter
            confirmParams: { return_url: returnUrl, payment_method: chosenMethodId },
          })
        : await confirmNewCard({ stripe, elements, clientSecret, opened, returnUrl, contact, saveMethod })

      if (error) {
        // Everything the shopper is not told. `lost_card` and `generic_decline` read identically
        // on screen and are distinguishable here, which is the whole point of the split.
        logPaymentFailure('Stripe confirmation failed', logFieldsForStripeError(error))
        return { kind: 'failed', customerMessage: customerMessageForStripeError(error) }
      }

      // Unreachable on a redirect: the tab has already left. Answered anyway, because a Stripe.js
      // that resolves without either an error or an intent must not read as success.
      if (!paymentIntent) return { kind: 'redirecting' }

      return outcomeForIntent(paymentIntent, 'Stripe confirmation left the payment unpaid')
    },
    [stripe, elements],
  )
}

/** The new-card leg: everything that only exists because a card was typed on this page. */
async function confirmNewCard({
  stripe,
  elements,
  clientSecret,
  opened,
  returnUrl,
  contact,
  saveMethod,
}: {
  stripe: Stripe
  elements: NonNullable<ReturnType<typeof useElements>>
  clientSecret: string
  opened: { amount: string; currencyCode: string }
  returnUrl: string
  contact: { email: string; phone: string | null }
  saveMethod: boolean
}) {
  // The server priced the cart; Stripe.js refuses a confirmation whose Elements options disagree
  // with the intent's, and the cart may well have changed since this form mounted. The same is
  // true of `setupFutureUsage`, which the server sets on the intent from the shopper's consent —
  // an Elements group that disagrees about it is refused just as an amount mismatch is.
  await elements.update({
    amount: toSmallestUnit(opened.amount, opened.currencyCode),
    currency: opened.currencyCode.toLowerCase(),
    setupFutureUsage: saveMethod ? 'on_session' : null,
  })

  return stripe.confirmPayment({
    elements,
    clientSecret,
    // `if_required` keeps a card in place and sends a redirect method away. Both paths end at the
    // same component — see the checkout return route.
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
        // The browser's half of `allow_redisplay`. The server sets it again after the charge,
        // because a card attached through `setup_future_usage` lands as `unspecified` and the
        // customer-scoped listing filters that straight back out — but saying so here means the
        // shopper's answer is on the confirmation itself rather than only on a follow-up call.
        // biome-ignore lint/style/useNamingConvention: Stripe SDK parameter
        allow_redisplay: saveMethod ? 'always' : 'unspecified',
      },
    },
  })
}

/**
 * The wallet, as this adapter's half of the port.
 *
 * The whole of it is our own API's, not Stripe's: `GET /store/payment-methods` projects every
 * provider's methods to the neutral shape and applies the one ordering in the system, and the
 * removal goes through the same hook the account page uses, against the same cache. What
 * implementing this declares is that this gateway *has* a wallet — the fact the selector branches
 * on — not that it holds a second copy of one.
 */
const stripeSavedMethods: NonNullable<StorePaymentAdapter['savedMethods']> = { useWallet }

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

      return outcomeForIntent(paymentIntent, 'Stripe returned from a redirect unpaid')
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
  savedMethods: stripeSavedMethods,
  useConfirm: useStripeConfirm,
  useResumeRedirect: useStripeResumeRedirect,
}
