import { HttpResponse, http } from 'msw'
import {
  advanceIntent,
  createCustomer,
  createIntent,
  deleteCustomer,
  detachPaymentMethod,
  type FakeIntent,
  findCustomerForProteusCustomer,
  getCustomer,
  getIntent,
  getPaymentMethod,
  listPaymentMethodsFor,
  recordCall,
  settledAmounts,
  updateCustomer,
  updateIntent,
  updatePaymentMethod,
} from './stripe-gateway-state.js'

/**
 * `api.stripe.com`, faked at the wire.
 *
 * The vitest suites fake the SDK at the module boundary (`stripe.ts`), which cannot work for the
 * e2e server: that runs the real backend in its own process, so the only seam is the HTTP call
 * itself. What reaches this file is the contract under test — a smallest-unit integer, the right
 * currency, a stable idempotency key — and every call is recorded so a spec can assert against
 * the gateway's own log rather than inferring from the UI.
 */

/**
 * Only what these handlers read off a request. Named structurally rather than as `Request`
 * because this workspace also carries Cloudflare's `Request` global, which is a different type
 * from the one MSW hands a resolver.
 */
type IncomingRequest = { text: () => Promise<string>; headers: { get: (name: string) => string | null } }

/** The Stripe SDK sends form-encoded bodies, including bracketed nesting for `metadata[key]`. */
async function formParams(request: IncomingRequest): Promise<Record<string, string>> {
  const body = new URLSearchParams(await request.text())
  return Object.fromEntries(body.entries())
}

function metadataOf(params: Record<string, string>): Record<string, string> {
  const metadata: Record<string, string> = {}
  for (const [key, value] of Object.entries(params)) {
    const match = key.match(/^metadata\[(.+)\]$/)
    if (match?.[1]) metadata[match[1]] = value
  }
  return metadata
}

function idempotencyKeyOf(request: IncomingRequest): string | null {
  return request.headers.get('idempotency-key')
}

/** Stripe's own error envelope, so the adapter's classification runs against the real shape. */
function stripeError(status: number, error: Record<string, unknown>) {
  return HttpResponse.json({ error }, { status })
}

const noSuchResource = (kind: string, id: string) =>
  stripeError(404, {
    type: 'invalid_request_error',
    code: 'resource_missing',
    message: `No such ${kind}: '${id}'`,
  })

const noSuchIntent = (id: string) => noSuchResource('payment_intent', id)

export const stripeHandlers = [
  http.post('https://api.stripe.com/v1/payment_intents', async ({ request }) => {
    const params = await formParams(request)
    recordCall('paymentIntents.create', { ...params }, idempotencyKeyOf(request))

    const intent = createIntent({
      amount: Number(params.amount),
      currency: params.currency ?? 'usd',
      metadata: metadataOf(params),
      captureMethod: params.capture_method ?? 'automatic',
      ...(params.customer ? { customer: params.customer } : {}),
      ...(params.setup_future_usage ? { setupFutureUsage: params.setup_future_usage } : {}),
      ...(params.payment_method ? { paymentMethod: params.payment_method } : {}),
    })
    return HttpResponse.json(intent)
  }),

  http.get('https://api.stripe.com/v1/payment_intents/:id', ({ params, request }) => {
    const id = String(params.id)
    recordCall('paymentIntents.retrieve', { id }, idempotencyKeyOf(request))

    const intent = getIntent(id)
    return intent ? HttpResponse.json(intent) : noSuchIntent(id)
  }),

  http.post('https://api.stripe.com/v1/payment_intents/:id/capture', async ({ params, request }) => {
    const id = String(params.id)
    recordCall('paymentIntents.capture', { id, ...(await formParams(request)) }, idempotencyKeyOf(request))

    const intent = getIntent(id)
    if (!intent) return noSuchIntent(id)
    if (intent.status !== 'requires_capture') {
      return stripeError(400, {
        type: 'invalid_request_error',
        code: 'payment_intent_unexpected_state',
        message: `This PaymentIntent's status is "${intent.status}", it cannot be captured.`,
        // biome-ignore lint/style/useNamingConvention: the Stripe wire field
        payment_intent: intent,
      })
    }
    return HttpResponse.json(advanceIntent(id, 'succeeded'))
  }),

  http.post('https://api.stripe.com/v1/payment_intents/:id/cancel', async ({ params, request }) => {
    const id = String(params.id)
    recordCall('paymentIntents.cancel', { id, ...(await formParams(request)) }, idempotencyKeyOf(request))

    const intent = getIntent(id)
    if (!intent) return noSuchIntent(id)
    return HttpResponse.json(advanceIntent(id, 'canceled'))
  }),

  http.post('https://api.stripe.com/v1/payment_intents/:id', async ({ params, request }) => {
    const id = String(params.id)
    const body = await formParams(request)
    recordCall('paymentIntents.update', { id, ...body }, idempotencyKeyOf(request))

    const updated = updateIntent(id, {
      amount: body.amount === undefined ? undefined : Number(body.amount),
      currency: body.currency,
    })
    return updated ? HttpResponse.json(updated) : noSuchIntent(id)
  }),

  http.post('https://api.stripe.com/v1/refunds', async ({ request }) => {
    const body = await formParams(request)
    recordCall('refunds.create', { ...body }, idempotencyKeyOf(request))
    return HttpResponse.json({ id: 're_fake', object: 'refund', ...body })
  }),

  // -- Account holders and their stored cards ---------------------------------------------------
  //
  // A guest must never reach any of these: nothing is created at the gateway for a shopper without
  // an account, which is what "guests leave no trace" means in the only sense that matters. The
  // guest spec asserts that by counting `customers.*` calls in the log below.

  http.post('https://api.stripe.com/v1/customers', async ({ request }) => {
    const params = await formParams(request)
    recordCall('customers.create', { ...params }, idempotencyKeyOf(request))

    // The adapter reuses a stored external id, so a second create for one Proteus customer means
    // the idempotency it promises has broken. Answering with the existing row is what the real
    // gateway does with a repeated idempotency key.
    const metadata = metadataOf(params)
    const existing = metadata.customerId ? findCustomerForProteusCustomer(metadata.customerId) : undefined
    if (existing) return HttpResponse.json(existing)

    return HttpResponse.json(
      createCustomer({
        ...(params.email ? { email: params.email } : {}),
        ...(params.name ? { name: params.name } : {}),
        metadata,
      }),
    )
  }),

  http.get('https://api.stripe.com/v1/customers/:id', ({ params, request }) => {
    const id = String(params.id)
    recordCall('customers.retrieve', { id }, idempotencyKeyOf(request))

    const customer = getCustomer(id)
    return customer ? HttpResponse.json(customer) : noSuchResource('customer', id)
  }),

  http.post('https://api.stripe.com/v1/customers/:id', async ({ params, request }) => {
    const id = String(params.id)
    const body = await formParams(request)
    recordCall('customers.update', { id, ...body }, idempotencyKeyOf(request))

    const updated = updateCustomer(id, {
      ...(body.email === undefined ? {} : { email: body.email }),
      ...(body.name === undefined ? {} : { name: body.name }),
      ...(body['invoice_settings[default_payment_method]'] === undefined
        ? {}
        : { defaultPaymentMethod: body['invoice_settings[default_payment_method]'] }),
    })
    return updated ? HttpResponse.json(updated) : noSuchResource('customer', id)
  }),

  http.delete('https://api.stripe.com/v1/customers/:id', ({ params, request }) => {
    const id = String(params.id)
    recordCall('customers.del', { id }, idempotencyKeyOf(request))

    const deleted = deleteCustomer(id)
    return deleted ? HttpResponse.json({ id, object: 'customer', deleted: true }) : noSuchResource('customer', id)
  }),

  http.get('https://api.stripe.com/v1/customers/:id/payment_methods', ({ params, request }) => {
    const id = String(params.id)
    const query = new URL(request.url).searchParams
    recordCall(
      'customers.listPaymentMethods',
      { id, ...Object.fromEntries(query.entries()) },
      idempotencyKeyOf(request),
    )

    if (!getCustomer(id)) return noSuchResource('customer', id)

    const data = listPaymentMethodsFor(id, {
      ...(query.get('allow_redisplay') ? { allowRedisplay: String(query.get('allow_redisplay')) } : {}),
      ...(query.get('limit') ? { limit: Number(query.get('limit')) } : {}),
    })
    // biome-ignore lint/style/useNamingConvention: the Stripe wire field
    return HttpResponse.json({ object: 'list', data, has_more: false })
  }),

  /**
   * The ownership check, and the reason it cannot be skipped by accident: the customer is part of
   * the URL rather than a filter someone remembered to apply.
   *
   * Two different refusals, exactly as the gateway gives them — `resource_missing` for a method
   * that does not exist, and a bare 404 for one that exists but belongs to somebody else. Stripe
   * declines to confirm another customer's payment method is real, and the adapter collapses both
   * into the same answer, so both have to be reachable here.
   */
  http.get('https://api.stripe.com/v1/customers/:customer/payment_methods/:id', ({ params, request }) => {
    const customerId = String(params.customer)
    const id = String(params.id)
    recordCall('customers.retrievePaymentMethod', { customer: customerId, id }, idempotencyKeyOf(request))

    const method = getPaymentMethod(id)
    if (!method) return noSuchResource('payment_method', id)
    if (method.customer !== customerId) {
      return stripeError(404, { type: 'invalid_request_error', message: 'No such PaymentMethod' })
    }
    return HttpResponse.json(method)
  }),

  http.post('https://api.stripe.com/v1/payment_methods/:id/detach', ({ params, request }) => {
    const id = String(params.id)
    recordCall('paymentMethods.detach', { id }, idempotencyKeyOf(request))

    const detached = detachPaymentMethod(id)
    return detached ? HttpResponse.json(detached) : noSuchResource('payment_method', id)
  }),

  http.post('https://api.stripe.com/v1/payment_methods/:id', async ({ params, request }) => {
    const id = String(params.id)
    const body = await formParams(request)
    recordCall('paymentMethods.update', { id, ...body }, idempotencyKeyOf(request))

    const updated = updatePaymentMethod(id, {
      ...(body.allow_redisplay ? { allowRedisplay: body.allow_redisplay as 'always' | 'limited' | 'unspecified' } : {}),
    })
    return updated ? HttpResponse.json(updated) : noSuchResource('payment_method', id)
  }),
]

/** Re-exported so the control server builds its responses from one definition of the shape. */
export type { FakeIntent }
export { settledAmounts }
