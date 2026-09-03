import { HttpResponse, http } from 'msw'
import {
  advanceIntent,
  createIntent,
  type FakeIntent,
  getIntent,
  recordCall,
  settledAmounts,
  updateIntent,
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

const noSuchIntent = (id: string) =>
  stripeError(404, {
    type: 'invalid_request_error',
    code: 'resource_missing',
    message: `No such payment_intent: '${id}'`,
  })

export const stripeHandlers = [
  http.post('https://api.stripe.com/v1/payment_intents', async ({ request }) => {
    const params = await formParams(request)
    recordCall('paymentIntents.create', { ...params }, idempotencyKeyOf(request))

    const intent = createIntent({
      amount: Number(params.amount),
      currency: params.currency ?? 'usd',
      metadata: metadataOf(params),
      captureMethod: params.capture_method ?? 'automatic',
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
]

/** Re-exported so the control server builds its responses from one definition of the shape. */
export type { FakeIntent }
export { settledAmounts }
