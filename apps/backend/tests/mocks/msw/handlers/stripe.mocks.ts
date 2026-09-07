import { HttpResponse, http } from 'msw'
import { FAKE_GATEWAY, stripeFactories } from '../../stripe-factories.js'

/**
 * Happy-path handlers for the Stripe API.
 *
 * The Stripe Node SDK sends form-encoded requests and expects JSON responses. MSW intercepts these
 * in the backend process (via `server.ts`) before they reach the real Stripe API — the e2e server
 * runs the real backend, so the HTTP call is the only seam available. The vitest suites fake the
 * SDK at the module boundary instead (`../../vitest/stripe.mock.ts`), where a module seam exists.
 *
 * Stateless by design. Nothing is stored between calls, so no spec can be affected by what another
 * spec did — which is what lets the suites run `fullyParallel`. A flow that needs a different
 * outcome asks for it through the request: see `FAKE_GATEWAY` for the values that mean something
 * other than the happy path.
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

const form = async (request: IncomingRequest) => Object.fromEntries(new URLSearchParams(await request.text()))

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
    const fields = await form(request)
    return HttpResponse.json(
      stripeFactories.paymentIntent({
        // The one total that opens a settling intent, so `retrieve` below can answer `processing`
        // for it without either handler remembering this call.
        ...(Number(fields.amount) === FAKE_GATEWAY.settlingTotalCents ? { id: FAKE_GATEWAY.settlingIntentId } : {}),
        amount: Number(fields.amount),
        currency: fields.currency,
        captureMethod: fields.capture_method,
        metadata: metadataOf(fields),
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
    return HttpResponse.json(stripeFactories.paymentIntent({ id, status }))
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
    const fields = await form(request)
    return HttpResponse.json(
      stripeFactories.paymentIntent({
        id: String(params.id),
        ...(fields.amount ? { amount: Number(fields.amount) } : {}),
        ...(fields.currency ? { currency: fields.currency } : {}),
      }),
    )
  }),

  http.post('https://api.stripe.com/v1/refunds', async ({ request }) =>
    HttpResponse.json(stripeFactories.refund(await form(request))),
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
    const fields = await form(request)
    const metadata = metadataOf(fields)
    return HttpResponse.json(
      stripeFactories.customer({
        ...(metadata.customerId ? { id: `cus_test_${metadata.customerId}` } : {}),
        ...(fields.email ? { email: fields.email } : {}),
        ...(fields.name ? { name: fields.name } : {}),
        metadata,
      }),
    )
  }),

  http.get('https://api.stripe.com/v1/customers/:id', ({ params }) =>
    HttpResponse.json(stripeFactories.customer({ id: String(params.id) })),
  ),

  http.post('https://api.stripe.com/v1/customers/:id', ({ params }) =>
    HttpResponse.json(stripeFactories.customer({ id: String(params.id) })),
  ),

  http.delete('https://api.stripe.com/v1/customers/:id', ({ params }) =>
    HttpResponse.json(stripeFactories.deletedCustomer(String(params.id))),
  ),

  // The wallet. One card, always the same one: a spec that needs a particular wallet stubs our own
  // `GET /store/payment-methods` at the browser instead, which is the boundary it can reach.
  http.get('https://api.stripe.com/v1/customers/:id/payment_methods', ({ params }) =>
    HttpResponse.json(stripeFactories.list([stripeFactories.paymentMethod({ customer: String(params.id) })])),
  ),

  // The ownership check. The customer is part of the URL rather than a filter someone remembered
  // to apply, which is why it cannot be skipped by accident.
  http.get('https://api.stripe.com/v1/customers/:customer/payment_methods/:id', ({ params }) => {
    const id = String(params.id)
    // A card the gateway no longer holds answers the same 404 a detached one does, which is what
    // the adapter turns into `payment_method_unavailable`.
    if (id.startsWith(FAKE_GATEWAY.goneMethodPrefix)) {
      return HttpResponse.json(stripeFactories.notYourPaymentMethod(), { status: 404 })
    }
    return HttpResponse.json(stripeFactories.paymentMethod({ id, customer: String(params.customer) }))
  }),

  http.post('https://api.stripe.com/v1/payment_methods/:id/detach', ({ params }) =>
    HttpResponse.json(stripeFactories.paymentMethod({ id: String(params.id), customer: null })),
  ),

  http.post('https://api.stripe.com/v1/payment_methods/:id', ({ params }) =>
    HttpResponse.json(stripeFactories.paymentMethod({ id: String(params.id) })),
  ),
]
