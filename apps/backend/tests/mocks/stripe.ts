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
  /** The intent's nominal total. What was actually taken, or is left to take, is below. */
  amount: number
  /**
   * What the charge actually took, and what an authorization has left to take. Kept apart from
   * `amount` because reading `amount` for either is only right by coincidence — see
   * `webhookAmountOf` in the adapter.
   */
  // biome-ignore lint/style/useNamingConvention: the Stripe field the adapter reads
  amount_received: number
  // biome-ignore lint/style/useNamingConvention: the Stripe field the adapter reads
  amount_capturable: number
  currency: string
  metadata: Record<string, string>
  // biome-ignore lint/style/useNamingConvention: the Stripe field the adapter reads
  client_secret: string
  // biome-ignore lint/style/useNamingConvention: the Stripe field the adapter reads
  last_payment_error?: { code: string }
  /** Set when the intent was opened against an account holder. */
  customer?: string
  /** Set when the shopper consented to save the card they are paying with. */
  // biome-ignore lint/style/useNamingConvention: the Stripe field the adapter reads
  setup_future_usage?: string
  /** The method the intent was confirmed with, which is what a saved card becomes. */
  // biome-ignore lint/style/useNamingConvention: the Stripe field the adapter reads
  payment_method?: string
}

/** What Stripe stores against a customer once a card has been attached to them. */
export type FakePaymentMethod = {
  id: string
  object: 'payment_method'
  type: 'card'
  customer: string | null
  /**
   * `unspecified` on attach, which is the trap the adapter exists to close: a card saved through
   * `setup_future_usage` lands here and the customer-scoped listing filters it straight back out.
   */
  // biome-ignore lint/style/useNamingConvention: the Stripe field the adapter reads
  allow_redisplay: 'always' | 'limited' | 'unspecified'
  /** Seconds, as Stripe counts. */
  created: number
  card: {
    brand: string
    last4: string
    // biome-ignore lint/style/useNamingConvention: the Stripe field the adapter reads
    exp_month: number
    // biome-ignore lint/style/useNamingConvention: the Stripe field the adapter reads
    exp_year: number
  }
}

export type FakeCustomer = {
  id: string
  object: 'customer'
  deleted?: boolean
  email?: string
  name?: string
  metadata: Record<string, string>
  // biome-ignore lint/style/useNamingConvention: the Stripe field the adapter reads
  invoice_settings: { default_payment_method: string | null }
}

type IntentCreateParams = {
  amount: number
  currency: string
  metadata?: Record<string, string>
  customer?: string
  // biome-ignore lint/style/useNamingConvention: the Stripe SDK parameter
  setup_future_usage?: string
  // biome-ignore lint/style/useNamingConvention: the Stripe SDK parameter
  payment_method?: string
}

/** The states in which the browser has already confirmed the intent with a card. */
const CONFIRMED_STATUSES: ReadonlySet<StripeSdk.PaymentIntent.Status> = new Set([
  'requires_capture',
  'succeeded',
  'processing',
])

/**
 * The state and the call log the tests assert against. One object rather than a fixture,
 * because `vi.mock` factories are hoisted above everything a fixture could inject.
 */
export const stripeGateway = {
  calls: [] as GatewayCall[],
  intents: new Map<string, FakeIntent>(),

  customers: new Map<string, FakeCustomer>(),
  methods: new Map<string, FakePaymentMethod>(),

  /** Errors queued per method, thrown one per call before the method does anything. */
  failures: new Map<string, unknown[]>(),

  /**
   * The state a created intent lands in. `requires_capture` is what a manual-capture intent
   * reaches once the shopper has confirmed it, which is where most of these tests start.
   */
  statusOnCreate: 'requires_capture' as StripeSdk.PaymentIntent.Status,

  reset() {
    this.calls = []
    this.intents = new Map()
    this.customers = new Map()
    this.methods = new Map()
    this.failures = new Map()
    this.statusOnCreate = 'requires_capture'
  },

  /**
   * The Stripe Customer created for a Proteus customer, found the way anyone reading the Stripe
   * dashboard would — through the metadata the adapter writes.
   *
   * Returns undefined when none was created, which is the assertion a guest test makes.
   */
  customerFor(proteusCustomerId: string): FakeCustomer | undefined {
    return [...this.customers.values()].find((customer) => customer.metadata.customerId === proteusCustomerId)
  },

  /** A card already in a customer's wallet, as a prior checkout would have left it. */
  storeMethod(
    customerId: string,
    overrides: Partial<Omit<FakePaymentMethod, 'card'>> & { card?: Partial<FakePaymentMethod['card']> } = {},
  ): FakePaymentMethod {
    const { card, ...rest } = overrides
    const method: FakePaymentMethod = {
      id: `pm_fake_${this.methods.size + 1}`,
      object: 'payment_method',
      type: 'card',
      customer: customerId,
      // biome-ignore lint/style/useNamingConvention: the Stripe field the adapter reads
      allow_redisplay: 'always',
      created: 1_700_000_000,
      card: {
        brand: 'visa',
        last4: '4242',
        // biome-ignore lint/style/useNamingConvention: the Stripe field the adapter reads
        exp_month: 12,
        // biome-ignore lint/style/useNamingConvention: the Stripe field the adapter reads
        exp_year: 2030,
        ...card,
      },
      ...rest,
    }
    this.methods.set(method.id, method)
    return method
  },

  /**
   * Makes the next call (or calls) to `method` throw. One queued error per call, in order, so a
   * test can say "fail once, then work" — which is the shape every retry assertion needs.
   */
  failNext(method: string, ...errors: unknown[]) {
    this.failures.set(method, [...(this.failures.get(method) ?? []), ...errors])
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
 * What Stripe reports as received and as capturable for an intent in a given state. A test that
 * needs the two to disagree with the nominal amount overrides them on the event body it builds;
 * this only keeps an untouched intent self-consistent.
 */
function settledAmounts(status: StripeSdk.PaymentIntent.Status, amount: number) {
  return {
    // biome-ignore lint/style/useNamingConvention: the Stripe field the adapter reads
    amount_received: status === 'succeeded' ? amount : 0,
    // biome-ignore lint/style/useNamingConvention: the Stripe field the adapter reads
    amount_capturable: status === 'requires_capture' ? amount : 0,
  }
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
  let nextCustomerId = 0

  function requireIntent(id: string): FakeIntent {
    const intent = stripeGateway.intents.get(id)
    if (!intent) throw new Error(`Fake Stripe has no PaymentIntent "${id}"`)
    return intent
  }

  function requireCustomer(id: string): FakeCustomer {
    const customer = stripeGateway.customers.get(id)
    if (!customer) throw new Error(`Fake Stripe has no Customer "${id}"`)
    return customer
  }

  /** Stripe's answer for a payment method id that names nothing. */
  const noSuchMethod = (id: string) =>
    new ActualStripe.errors.StripeInvalidRequestError({
      type: 'invalid_request_error',
      code: 'resource_missing',
      param: 'payment_method',
      statusCode: 404,
      message: `No such PaymentMethod: '${id}'`,
      // biome-ignore lint/style/useNamingConvention: the raw Stripe field name
      request_log_url: 'https://dashboard.stripe.com/test/logs/req_missing',
    })

  /**
   * Stripe's answer for a method that exists and is somebody else's: a bare 404, with no code
   * and no param, because it will not confirm that another customer's method is real.
   */
  const notYourMethod = () =>
    new ActualStripe.errors.StripeInvalidRequestError({
      type: 'invalid_request_error',
      statusCode: 404,
      message: 'No such payment_method',
      // biome-ignore lint/style/useNamingConvention: the raw Stripe field name
      request_log_url: 'https://dashboard.stripe.com/test/logs/req_foreign',
    })

  /**
   * What `setup_future_usage` does at the gateway: the confirmed card is attached to the
   * customer, and its `allow_redisplay` is left `unspecified`. Modelled here because it is the
   * whole reason the adapter has to set `allow_redisplay` itself — a fake that attached the card
   * as `always` would let a broken adapter pass.
   */
  function attachConfirmedMethod(intent: FakeIntent): void {
    if (!intent.customer || !intent.setup_future_usage) return
    if (!CONFIRMED_STATUSES.has(intent.status)) return

    const attached = stripeGateway.storeMethod(intent.customer, {
      // biome-ignore lint/style/useNamingConvention: the Stripe field the adapter reads
      allow_redisplay: 'unspecified',
      created: 1_800_000_000,
    })
    intent.payment_method = attached.id
  }

  /** Throws whatever `failNext` queued for this method, once per queued error. */
  function throwIfQueued(method: string) {
    const queued = stripeGateway.failures.get(method)
    if (!queued?.length) return
    throw queued.shift()
  }

  class FakeStripe {
    static errors = ActualStripe.errors

    /**
     * The adapter asks for the fetch client explicitly, because the default one does not exist on
     * workerd. The fake makes no HTTP calls, so it only has to answer the question.
     */
    static createFetchHttpClient = ActualStripe.createFetchHttpClient

    /** Stripe's real webhook helper — verification is the thing under test, not a stub. */
    webhooks: StripeSdk['webhooks']

    constructor(apiKey: string) {
      this.webhooks = new ActualStripe(apiKey).webhooks
    }

    paymentIntents = {
      create: async (params: IntentCreateParams, options?: unknown) => {
        stripeGateway.calls.push({ method: 'paymentIntents.create', params: { ...params, options } })
        throwIfQueued('paymentIntents.create')

        nextIntentId += 1
        const intent: FakeIntent = {
          id: `pi_fake_${nextIntentId}`,
          status: stripeGateway.statusOnCreate,
          amount: params.amount,
          currency: params.currency,
          metadata: params.metadata ?? {},
          // biome-ignore lint/style/useNamingConvention: the Stripe field the adapter reads
          client_secret: `pi_fake_${nextIntentId}_secret`,
          ...settledAmounts(stripeGateway.statusOnCreate, params.amount),
          ...(params.customer ? { customer: params.customer } : {}),
          // biome-ignore lint/style/useNamingConvention: the Stripe field the adapter reads
          ...(params.setup_future_usage ? { setup_future_usage: params.setup_future_usage } : {}),
          // biome-ignore lint/style/useNamingConvention: the Stripe field the adapter reads
          ...(params.payment_method ? { payment_method: params.payment_method } : {}),
        }
        stripeGateway.intents.set(intent.id, intent)
        // The browser's confirmation, which the tests start after: a new card, consented to,
        // arrives attached to the customer.
        if (!params.payment_method) attachConfirmedMethod(intent)
        return intent
      },

      retrieve: async (id: string) => {
        stripeGateway.calls.push({ method: 'paymentIntents.retrieve', params: { id } })
        throwIfQueued('paymentIntents.retrieve')
        return requireIntent(id)
      },

      capture: async (id: string, params?: unknown, options?: unknown) => {
        stripeGateway.calls.push({ method: 'paymentIntents.capture', params: { id, params, options } })
        throwIfQueued('paymentIntents.capture')
        const intent = requireIntent(id)
        intent.status = 'succeeded'
        Object.assign(intent, settledAmounts('succeeded', intent.amount))
        return intent
      },

      cancel: async (id: string, params?: unknown, options?: unknown) => {
        stripeGateway.calls.push({ method: 'paymentIntents.cancel', params: { id, params, options } })
        throwIfQueued('paymentIntents.cancel')
        const intent = requireIntent(id)
        intent.status = 'canceled'
        Object.assign(intent, settledAmounts('canceled', intent.amount))
        return intent
      },

      update: async (id: string, params: { amount?: number; currency?: string }, options?: unknown) => {
        stripeGateway.calls.push({ method: 'paymentIntents.update', params: { id, ...params, options } })
        throwIfQueued('paymentIntents.update')
        const intent = requireIntent(id)
        if (params.amount !== undefined) intent.amount = params.amount
        if (params.currency !== undefined) intent.currency = params.currency
        Object.assign(intent, settledAmounts(intent.status, intent.amount))
        return intent
      },
    }

    refunds = {
      create: async (params: { amount: number }, options?: unknown) => {
        stripeGateway.calls.push({ method: 'refunds.create', params: { ...params, options } })
        throwIfQueued('refunds.create')
        return { id: 're_fake', ...params }
      },
    }

    customers = {
      create: async (
        params: { email?: string; name?: string; metadata?: Record<string, string> },
        options?: unknown,
      ) => {
        stripeGateway.calls.push({ method: 'customers.create', params: { ...params, options } })
        throwIfQueued('customers.create')

        // Stripe replays a request carrying a key it has already seen rather than performing it
        // again, which is the half of "created once" that our unique index cannot provide: two
        // concurrent checkouts must not leave two Customers behind, only one of which we keep.
        const key = (options as { idempotencyKey?: string } | undefined)?.idempotencyKey
        const replayed = key && [...stripeGateway.customers.values()].find((c) => c.metadata.idempotencyKey === key)
        if (replayed) return replayed

        nextCustomerId += 1
        const customer: FakeCustomer = {
          id: `cus_fake_${nextCustomerId}`,
          object: 'customer',
          ...(params.email ? { email: params.email } : {}),
          ...(params.name ? { name: params.name } : {}),
          metadata: { ...(params.metadata ?? {}), ...(key ? { idempotencyKey: key } : {}) },
          // biome-ignore lint/style/useNamingConvention: the Stripe field the adapter reads
          invoice_settings: { default_payment_method: null },
        }
        stripeGateway.customers.set(customer.id, customer)
        return customer
      },

      retrieve: async (id: string) => {
        stripeGateway.calls.push({ method: 'customers.retrieve', params: { id } })
        throwIfQueued('customers.retrieve')
        return requireCustomer(id)
      },

      update: async (
        id: string,
        // biome-ignore lint/style/useNamingConvention: the Stripe SDK parameter
        params: { invoice_settings?: { default_payment_method?: string } },
        options?: unknown,
      ) => {
        stripeGateway.calls.push({ method: 'customers.update', params: { id, ...params, options } })
        throwIfQueued('customers.update')
        const customer = requireCustomer(id)
        const nominated = params.invoice_settings?.default_payment_method
        if (nominated) customer.invoice_settings.default_payment_method = nominated
        return customer
      },

      del: async (id: string) => {
        stripeGateway.calls.push({ method: 'customers.del', params: { id } })
        throwIfQueued('customers.del')
        const customer = requireCustomer(id)
        customer.deleted = true
        return customer
      },

      /**
       * The customer-scoped listing. The customer is part of the path, so unlike
       * `paymentMethods.list({ customer })` there is no way to ask it for everybody's cards.
       */
      listPaymentMethods: async (
        customerId: string,
        // biome-ignore lint/style/useNamingConvention: the Stripe SDK parameter
        params?: { limit?: number; allow_redisplay?: string },
      ) => {
        stripeGateway.calls.push({ method: 'customers.listPaymentMethods', params: { customerId, ...params } })
        throwIfQueued('customers.listPaymentMethods')
        requireCustomer(customerId)

        const data = [...stripeGateway.methods.values()]
          .filter((method) => method.customer === customerId)
          .filter((method) => !params?.allow_redisplay || method.allow_redisplay === params.allow_redisplay)
          .slice(0, params?.limit ?? 10)

        return { object: 'list', data }
      },

      retrievePaymentMethod: async (customerId: string, methodId: string) => {
        stripeGateway.calls.push({ method: 'customers.retrievePaymentMethod', params: { customerId, methodId } })
        throwIfQueued('customers.retrievePaymentMethod')

        const method = stripeGateway.methods.get(methodId)
        if (!method) throw noSuchMethod(methodId)
        if (method.customer !== customerId) throw notYourMethod()
        return method
      },
    }

    paymentMethods = {
      detach: async (id: string) => {
        stripeGateway.calls.push({ method: 'paymentMethods.detach', params: { id } })
        throwIfQueued('paymentMethods.detach')
        const method = stripeGateway.methods.get(id)
        if (!method) throw noSuchMethod(id)
        method.customer = null
        return method
      },

      // biome-ignore lint/style/useNamingConvention: the Stripe SDK parameter
      update: async (id: string, params: { allow_redisplay?: FakePaymentMethod['allow_redisplay'] }) => {
        stripeGateway.calls.push({ method: 'paymentMethods.update', params: { id, ...params } })
        throwIfQueued('paymentMethods.update')
        const method = stripeGateway.methods.get(id)
        if (!method) throw noSuchMethod(id)
        if (params.allow_redisplay) method.allow_redisplay = params.allow_redisplay
        return method
      },
    }
  }

  return { ...actual, default: FakeStripe }
}
