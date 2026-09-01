/**
 * A stand-in for the Stripe SDK, faked at the module boundary.
 *
 * What reaches the gateway is the contract under test — a smallest-unit integer, the right
 * currency, the bytes a signature was computed over — so the fake records every call and keeps
 * the intents it was asked to create, rather than returning canned values. Signature
 * verification is deliberately *not* faked: `webhooks` is Stripe's own implementation, so a
 * test that alters a signed payload fails exactly the way the real gateway would.
 */

import { createHmac } from 'node:crypto'
import type StripeSdk from 'stripe'
import { vi } from 'vitest'

export type GatewayCall = { method: string; params: Record<string, unknown> }

export type FakeIntent = {
  id: string
  status: StripeSdk.PaymentIntent.Status
  amount: number
  currency: string
  metadata: Record<string, string>
  // biome-ignore lint/style/useNamingConvention: the Stripe field the adapter reads
  client_secret: string
  // biome-ignore lint/style/useNamingConvention: the Stripe field the adapter reads
  last_payment_error?: { code: string }
}

type IntentCreateParams = {
  amount: number
  currency: string
  metadata?: Record<string, string>
}

/**
 * The state and the call log the tests assert against. One object rather than a fixture,
 * because `vi.mock` factories are hoisted above everything a fixture could inject.
 */
export const stripeGateway = {
  calls: [] as GatewayCall[],
  intents: new Map<string, FakeIntent>(),

  /**
   * The state a created intent lands in. `requires_capture` is what a manual-capture intent
   * reaches once the shopper has confirmed it, which is where most of these tests start.
   */
  statusOnCreate: 'requires_capture' as StripeSdk.PaymentIntent.Status,

  reset() {
    this.calls = []
    this.intents = new Map()
    this.statusOnCreate = 'requires_capture'
  },

  callsTo(method: string): GatewayCall[] {
    return this.calls.filter((call) => call.method === method)
  },

  /** The intent created for a payment session, found the way Stripe would — through metadata. */
  intentForSession(sessionId: string): FakeIntent | undefined {
    return [...this.intents.values()].find((intent) => intent.metadata.sessionId === sessionId)
  },
}

/**
 * Stripe's documented signature scheme: an HMAC-SHA256 over `<timestamp>.<payload>`. Written
 * out rather than taken from the SDK's test helper so the tests pin the wire format itself.
 */
export function signWebhook(payload: string | Uint8Array, secret: string, timestamp = Math.floor(Date.now() / 1000)) {
  const body = typeof payload === 'string' ? payload : new TextDecoder('utf8').decode(payload)
  const signature = createHmac('sha256', secret).update(`${timestamp}.${body}`).digest('hex')
  return `t=${timestamp},v1=${signature}`
}

/** A webhook event body around an intent, serialized the way Stripe sends it — indented. */
export function webhookEventBody(type: string, intent: FakeIntent, id = 'evt_test'): string {
  return JSON.stringify({ id, object: 'event', type, data: { object: intent } }, null, 2)
}

/**
 * The module factory. Test files register it with:
 *
 * ```ts
 * vi.mock('stripe', async () => (await import('@tests/mocks/stripe.js')).stripeModuleMock())
 * ```
 */
export async function stripeModuleMock() {
  const actual = await vi.importActual<typeof import('stripe')>('stripe')
  const ActualStripe = actual.default

  let nextIntentId = 0

  function requireIntent(id: string): FakeIntent {
    const intent = stripeGateway.intents.get(id)
    if (!intent) throw new Error(`Fake Stripe has no PaymentIntent "${id}"`)
    return intent
  }

  class FakeStripe {
    static errors = ActualStripe.errors

    /** Stripe's real webhook helper — verification is the thing under test, not a stub. */
    webhooks: StripeSdk['webhooks']

    constructor(apiKey: string) {
      this.webhooks = new ActualStripe(apiKey).webhooks
    }

    paymentIntents = {
      create: async (params: IntentCreateParams, options?: unknown) => {
        stripeGateway.calls.push({ method: 'paymentIntents.create', params: { ...params, options } })

        nextIntentId += 1
        const intent: FakeIntent = {
          id: `pi_fake_${nextIntentId}`,
          status: stripeGateway.statusOnCreate,
          amount: params.amount,
          currency: params.currency,
          metadata: params.metadata ?? {},
          // biome-ignore lint/style/useNamingConvention: the Stripe field the adapter reads
          client_secret: `pi_fake_${nextIntentId}_secret`,
        }
        stripeGateway.intents.set(intent.id, intent)
        return intent
      },

      retrieve: async (id: string) => {
        stripeGateway.calls.push({ method: 'paymentIntents.retrieve', params: { id } })
        return requireIntent(id)
      },

      capture: async (id: string, params?: unknown, options?: unknown) => {
        stripeGateway.calls.push({ method: 'paymentIntents.capture', params: { id, params, options } })
        const intent = requireIntent(id)
        intent.status = 'succeeded'
        return intent
      },

      cancel: async (id: string, params?: unknown, options?: unknown) => {
        stripeGateway.calls.push({ method: 'paymentIntents.cancel', params: { id, params, options } })
        const intent = requireIntent(id)
        intent.status = 'canceled'
        return intent
      },

      update: async (id: string, params: { amount?: number; currency?: string }, options?: unknown) => {
        stripeGateway.calls.push({ method: 'paymentIntents.update', params: { id, ...params, options } })
        const intent = requireIntent(id)
        if (params.amount !== undefined) intent.amount = params.amount
        if (params.currency !== undefined) intent.currency = params.currency
        return intent
      },
    }

    refunds = {
      create: async (params: { amount: number }, options?: unknown) => {
        stripeGateway.calls.push({ method: 'refunds.create', params: { ...params, options } })
        return { id: 're_fake', ...params }
      },
    }
  }

  return { ...actual, default: FakeStripe }
}
