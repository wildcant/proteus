import { HttpResponse, http } from 'msw'
import {
  allowRedisplayOf,
  FAKE_GATEWAY,
  gatewayCustomerId,
  gatewayIntentId,
  MOCK_INTENT_ID,
  methodIdOfCard,
  stripeFactories,
} from '../../stripe-factories.js'
import { gatewayWallet } from './stripe-wallet.js'

/**
 * Happy-path handlers for the Stripe API.
 *
 * The Stripe Node SDK sends form-encoded requests and expects JSON responses. MSW intercepts these
 * in the backend process (via `server.ts`) before they reach the real Stripe API — the e2e server
 * runs the real backend, so the HTTP call is the only seam available. The vitest suites fake the
 * SDK at the module boundary instead (`../../vitest/stripe.mock.ts`), where a module seam exists.
 *
 * Almost everything here is a pure function of its request — a flow that needs an outcome other
 * than the happy path asks for it through the request; see `FAKE_GATEWAY`. The exception is the
 * wallet, which is state because a wallet *is* state: see `stripe-wallet.ts`. It is keyed by
 * Stripe customer, and a spec's customer comes from its own factory, so the suites still run
 * `fullyParallel`.
 *
 * Covers the card checkout flow: create the intent → authorize (retrieve) → capture, plus the
 * account holder and stored-card calls the wallet makes.
 */

/**
 * Only what these handlers read off a request. Named structurally rather than as `Request` because
 * this workspace also carries Cloudflare's `Request` global, which is a different type from the one
 * MSW hands a resolver.
 */
type IncomingRequest = { text: () => Promise<string> }

/** The form-encoded body the Stripe SDK sends, as the flat record every handler below reads. */
const formFields = async (request: IncomingRequest) => Object.fromEntries(new URLSearchParams(await request.text()))

/**
 * The card a saved checkout leaves behind.
 *
 * One card, and always this one: the browser's fake Stripe.js and this fake cannot talk — the
 * storefront's adapter hands the server an intent id and nothing else — so what was typed into the
 * card form never reaches here. Wallets of several distinct cards are therefore not reachable by
 * shopping, and the claims needing one are asserted where they can be: the ordering rule in
 * `payment-method.api.test.ts`, the row's own rendering in `saved-card-row.browser.test.tsx`.
 *
 * The expiry is far enough out that a wallet saved today is still usable whenever the suite runs.
 */
const SAVED_CARD = { brand: 'visa', last4: '4242', expMonth: 12, expYear: new Date().getFullYear() + 3 }

/** The SDK sends bracketed nesting for `metadata[key]`; this reads it back out. */
function metadataOf(fields: Record<string, string>): Record<string, string> {
  const metadata: Record<string, string> = {}
  for (const [key, value] of Object.entries(fields)) {
    const match = key.match(/^metadata\[(.+)\]$/)
    if (match?.[1]) metadata[match[1]] = value
  }
  return metadata
}

export const stripeHandlers = [
  // --- The payment ---

  // Create the intent — the amount and currency are echoed back so the shopper is quoted what the
  // server priced, which is the one thing Stripe.js refuses a confirmation over.
  http.post('https://api.stripe.com/v1/payment_intents', async ({ request }) => {
    const fields = await formFields(request)
    const metadata = metadataOf(fields)

    // The intent's own id, derived from the payment session it belongs to.
    //
    // One fixed id for every intent is the same defect one fixed customer id was: two concurrent
    // checkouts become one intent, and the second overwrites what the first is holding — so a card
    // is attached to whichever shopper created last. It cost two green-alone, red-together specs
    // before being found here rather than in the wallet. `metadata.sessionId` is on the request the
    // provider already sends, so this stays a pure function of it.
    const id =
      Number(fields.amount) === FAKE_GATEWAY.settlingTotalCents
        ? FAKE_GATEWAY.settlingIntentId
        : metadata.sessionId
          ? gatewayIntentId(metadata.sessionId)
          : MOCK_INTENT_ID

    // Held for the retrieve below, which is where a card actually joins a wallet.
    gatewayWallet.rememberIntent(id, {
      customer: fields.customer,
      savesCard: Boolean(fields.setup_future_usage),
    })

    return HttpResponse.json(
      stripeFactories.paymentIntent({
        id,
        amount: Number(fields.amount),
        currency: fields.currency,
        captureMethod: fields.capture_method,
        metadata,
        ...(fields.customer ? { customer: fields.customer } : {}),
        ...(fields.setup_future_usage ? { setupFutureUsage: fields.setup_future_usage } : {}),
        ...(fields.payment_method ? { paymentMethod: fields.payment_method } : {}),
      }),
    )
  }),

  // Retrieve — the authorize step. `requires_capture` is what the adapter maps to `authorized`,
  // which is the state a manual-capture intent is in once the browser has confirmed it.
  http.get('https://api.stripe.com/v1/payment_intents/:id', ({ params }) => {
    const id = String(params.id)
    const status = id === FAKE_GATEWAY.settlingIntentId ? 'processing' : 'requires_capture'
    const opened = gatewayWallet.intentOf(id)

    // The confirmed intent names the method the browser paid with, which is the first moment the
    // *server* sees it — the storefront's adapter hands back an intent id and nothing more. The
    // card it names is the happy-path Visa, because the two fakes cannot talk about what was
    // typed; see the note on `SAVED_CARD`.
    const paymentMethod = `${methodIdOfCard(SAVED_CARD)}_${id}`

    // `setup_future_usage` attaches the method to the customer, exactly as Stripe does — and
    // leaves it un-redisplayable until the provider's second call says otherwise.
    if (opened?.savesCard && opened.customer && status === 'requires_capture') {
      gatewayWallet.attach(opened.customer, paymentMethod)
    }

    return HttpResponse.json(
      stripeFactories.paymentIntent({
        id,
        status,
        paymentMethod,
        ...(opened?.customer ? { customer: opened.customer } : {}),
        ...(opened?.savesCard ? { setupFutureUsage: 'on_session' } : {}),
      }),
    )
  }),

  // Capture — registered before the bare `:id` POST below, which would otherwise match it first.
  http.post('https://api.stripe.com/v1/payment_intents/:id/capture', ({ params }) =>
    HttpResponse.json(stripeFactories.paymentIntent({ id: String(params.id), status: 'succeeded' })),
  ),

  http.post('https://api.stripe.com/v1/payment_intents/:id/cancel', ({ params }) =>
    HttpResponse.json(stripeFactories.paymentIntent({ id: String(params.id), status: 'canceled' })),
  ),

  // Update — the cart changed after the intent was opened.
  http.post('https://api.stripe.com/v1/payment_intents/:id', async ({ params, request }) => {
    const fields = await formFields(request)
    return HttpResponse.json(
      stripeFactories.paymentIntent({
        id: String(params.id),
        ...(fields.amount ? { amount: Number(fields.amount) } : {}),
        ...(fields.currency ? { currency: fields.currency } : {}),
      }),
    )
  }),

  http.post('https://api.stripe.com/v1/refunds', async ({ request }) =>
    HttpResponse.json(stripeFactories.refund(await formFields(request))),
  ),

  // --- Account holders and their stored cards ---
  //
  // A guest never reaches these: nothing is created at the gateway for a shopper without an
  // account. That is asserted in the backend suite, where the provider can be observed directly.

  // The id is derived from the shopper it was created for, not fixed.
  //
  // Two account holders sharing one gateway id is not a cosmetic problem: the mapping from a
  // Proteus customer to a Stripe Customer is what every wallet call is scoped by, so one id for
  // everybody makes two concurrent shoppers the same shopper. It cost a run of e2e failures that
  // each passed in isolation. `metadata[customerId]` is on the request the adapter already sends,
  // so this stays a pure function of it.
  http.post('https://api.stripe.com/v1/customers', async ({ request }) => {
    const fields = await formFields(request)
    const metadata = metadataOf(fields)
    return HttpResponse.json(
      stripeFactories.customer({
        ...(metadata.customerId ? { id: gatewayCustomerId(metadata.customerId) } : {}),
        ...(fields.email ? { email: fields.email } : {}),
        ...(fields.name ? { name: fields.name } : {}),
        metadata,
      }),
    )
  }),

  http.get('https://api.stripe.com/v1/customers/:id', ({ params }) => {
    const id = String(params.id)
    return HttpResponse.json(stripeFactories.customer({ id, defaultPaymentMethod: gatewayWallet.defaultOf(id) }))
  }),

  // Nominating a default. Stripe keeps it on the customer, never on the merchant's own tables,
  // which is why the wallet reads it back from here rather than from a Proteus row.
  http.post('https://api.stripe.com/v1/customers/:id', async ({ params, request }) => {
    const id = String(params.id)
    const fields = await formFields(request)
    const nominated = fields['invoice_settings[default_payment_method]']
    if (nominated) gatewayWallet.setDefault(id, nominated)
    return HttpResponse.json(stripeFactories.customer({ id, defaultPaymentMethod: gatewayWallet.defaultOf(id) }))
  }),

  http.delete('https://api.stripe.com/v1/customers/:id', ({ params }) =>
    HttpResponse.json(stripeFactories.deletedCustomer(String(params.id))),
  ),

  // The wallet: exactly the cards this customer has saved, and nothing for one who has saved none.
  // An empty wallet used to be unreachable — the fake handed every account holder the same card —
  // which is what pushed the specs into stubbing our own route.
  http.get('https://api.stripe.com/v1/customers/:id/payment_methods', ({ params }) =>
    HttpResponse.json(stripeFactories.list(gatewayWallet.list(String(params.id)))),
  ),

  // The ownership check. The customer is part of the URL rather than a filter someone remembered
  // to apply, which is why it cannot be skipped by accident.
  http.get('https://api.stripe.com/v1/customers/:customer/payment_methods/:id', ({ params }) => {
    const id = String(params.id)
    const customer = String(params.customer)
    // A card this customer does not hold answers the same 404 a detached one does, which is what
    // the adapter turns into `payment_method_unavailable`. A card removed in another tab reaches
    // this by simply not being there any more — no magic id is needed to arrange it.
    const held = gatewayWallet.find(customer, id)
    if (!held) {
      return HttpResponse.json(stripeFactories.notYourPaymentMethod(), { status: 404 })
    }
    return HttpResponse.json(held)
  }),

  http.post('https://api.stripe.com/v1/payment_methods/:id/detach', ({ params }) => {
    const id = String(params.id)
    gatewayWallet.detach(id)
    return HttpResponse.json(stripeFactories.paymentMethod({ id, customer: null }))
  }),

  // `allow_redisplay: 'always'` — the provider's `markRedisplayable`. Without it an attached card
  // stays filtered out of every customer-scoped listing, so this handler is what makes that call
  // observable rather than decorative.
  http.post('https://api.stripe.com/v1/payment_methods/:id', async ({ params, request }) => {
    const id = String(params.id)
    const fields = await formFields(request)
    if (fields.allow_redisplay === 'always') gatewayWallet.markRedisplayable(id)
    return HttpResponse.json(
      stripeFactories.paymentMethod({ id, allowRedisplay: allowRedisplayOf(fields.allow_redisplay) }),
    )
  }),
]
