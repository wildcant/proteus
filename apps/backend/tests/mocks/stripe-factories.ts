/**
 * Canned Stripe objects, in the shapes the wire uses.
 *
 * Every field name here is Stripe's rather than this codebase's, so each literal needs a
 * `useNamingConvention` suppression. Keeping them in one file is what lets the handlers next door
 * read as a flat list, and gives the wire format a single definition to check against the docs.
 *
 * Pure. A factory takes the few fields a handler echoes back from the request and fills in the
 * rest; it decides nothing on its own. The only thing the fake remembers between calls is the
 * wallet, which lives in `msw/handlers/stripe-wallet.ts` and explains itself there.
 */

/**
 * The ids the fake mints, derived from what the adapter already puts on the request.
 *
 * Both fakes build these — the wire one in `msw/handlers/stripe.mocks.ts` and the module one in
 * `vitest/stripe.mock.ts` — and a test that names an id before the call that creates it (see
 * `stripeTest.gatewayCustomerIdFor`) has to agree with whichever answered. One definition rather
 * than five template literals that drift apart silently.
 */
export const gatewayCustomerId = (customerId: string) => `cus_test_${customerId}`
export const gatewayIntentId = (sessionId: string) => `pi_test_${sessionId}`

/**
 * What those ids come out as when the request carries nothing to derive them from — a call made
 * outside a checkout, or a factory asked for a bare object. Never a shared identity for two
 * shoppers: anything reached by shopping is keyed by the session or the customer it belongs to.
 */
export const MOCK_INTENT_ID = gatewayIntentId('mock')
const MOCK_CUSTOMER_ID = gatewayCustomerId('mock')
const MOCK_PAYMENT_METHOD_ID = 'pm_test_mock'

/**
 * Values the fake reads as instructions rather than as data.
 *
 * The same device Stripe itself uses: `4000000000000002` is not a card, it is "decline this". The
 * store e2e runs the real backend in its own process, so the only thing a spec there can vary is
 * what it puts *into* the checkout — and for a payment left settling, that is the total it builds
 * a cart to. Encoding the outcome in the request keeps the handler a pure function of it.
 *
 * There is no entry here for "a card the gateway no longer holds": the wallet is real now, so a
 * card removed in another tab is gone because it was removed, and the ownership check answers its
 * 404 on its own.
 *
 * The store's async-payment e2e holds the same figure as `SETTLING_TOTAL_CENTS`, kept in step by
 * hand: the store declares no dependency on the backend. Drift fails that spec rather than passing
 * it, because a total this handler does not recognise authorizes normally.
 */
export const FAKE_GATEWAY = {
  /** A total the gateway confirms and keeps settling: its intent reads back as `processing`. */
  settlingTotalCents: 4277,
  /** The intent that total opens. Derived from the amount, so `retrieve` can answer without state. */
  settlingIntentId: 'pi_test_settling',
} as const

/**
 * A card, written into the payment method id that carries it.
 *
 * The gateway is handed an id and nothing else — the browser confirms the card, and all the server
 * ever sees is `pm_...`. Encoding the card into the id is what lets the wallet answer with the card
 * the shopper actually typed, instead of one canned card for everybody. It is the same device as
 * `FAKE_GATEWAY`: the request carries the answer, so the handler stays a pure function of it.
 *
 * `pm_test_visa_4242_12_2034` — brand, last four, expiry month, expiry year.
 */
export function methodIdOfCard(card: { brand: string; last4: string; expMonth: number; expYear: number }): string {
  return `pm_test_${card.brand}_${card.last4}_${card.expMonth}_${card.expYear}`
}

/**
 * Reads a card back out of its id.
 *
 * `created` is nudged by the card's position in the wallet so that "most recent first" has
 * something real to sort on — two cards saved in the same second would otherwise tie, and the
 * ordering rule under test would be decided by chance.
 */
export function cardFromMethodId(id: string, position = 0): StripeCard {
  const [brand, last4, expMonth, expYear] = id.replace(/^pm_test_/, '').split('_')
  return stripeFactories.paymentMethod({
    id,
    brand: brand || 'visa',
    last4: last4 || '4242',
    expMonth: Number(expMonth) || 12,
    expYear: Number(expYear) || 2030,
    created: 1_767_225_600 + position,
  })
}

/**
 * Stripe's consent flag on a stored card. Named rather than inlined because a handler reading it
 * back off a form-encoded request has a `string` in hand and needs something to narrow *to*.
 */
export type AllowRedisplay = 'always' | 'limited' | 'unspecified'

/** The same three values at runtime, for narrowing a request field that is only ever a string. */
const ALLOW_REDISPLAY_VALUES: readonly AllowRedisplay[] = ['always', 'limited', 'unspecified']

/** A request's `allow_redisplay`, or `undefined` when it is absent or not one of Stripe's three. */
export function allowRedisplayOf(value: string | undefined): AllowRedisplay | undefined {
  return ALLOW_REDISPLAY_VALUES.find((candidate) => candidate === value)
}

export type IntentStatus =
  | 'requires_payment_method'
  | 'requires_confirmation'
  | 'requires_action'
  | 'processing'
  | 'requires_capture'
  | 'succeeded'
  | 'canceled'

/**
 * Building and signing the events this route receives. Not mocking: signature verification is
 * left as Stripe's own implementation, so a test that alters a signed payload fails exactly the
 * way the real gateway would — these only produce input for it.
 *
 * Here rather than in a shared module because this is the only suite that sends a webhook.
 */

/** The intent fields a webhook event carries. */
export type FakeIntent = {
  id: string
  status: IntentStatus
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
  client_secret?: string
  // biome-ignore lint/style/useNamingConvention: the Stripe field the adapter reads
  last_payment_error?: { code: string }
  customer?: string
  // biome-ignore lint/style/useNamingConvention: the Stripe field the adapter reads
  setup_future_usage?: string
  // biome-ignore lint/style/useNamingConvention: the Stripe field the adapter reads
  payment_method?: string
}

/** What a handler echoes back from the request it answered. */
type IntentOverrides = {
  id?: string
  status?: IntentStatus
  amount?: number
  currency?: string
  captureMethod?: string
  metadata?: Record<string, string>
  customer?: string
  setupFutureUsage?: string
  paymentMethod?: string
}

export const stripeFactories = {
  /**
   * A PaymentIntent in whatever state the handler says.
   *
   * `amount_received` and `amount_capturable` follow the status rather than being passed, because
   * Stripe reports them that way and the adapter reads them.
   */
  paymentIntent(overrides: IntentOverrides = {}) {
    const id = overrides.id ?? MOCK_INTENT_ID
    const status = overrides.status ?? 'requires_payment_method'
    const amount = overrides.amount ?? 5000

    return {
      id,
      object: 'payment_intent',
      status,
      amount,
      // biome-ignore lint/style/useNamingConvention: the Stripe wire field
      amount_received: status === 'succeeded' ? amount : 0,
      // biome-ignore lint/style/useNamingConvention: the Stripe wire field
      amount_capturable: status === 'requires_capture' ? amount : 0,
      currency: overrides.currency ?? 'usd',
      // biome-ignore lint/style/useNamingConvention: the Stripe wire field
      capture_method: overrides.captureMethod ?? 'manual',
      metadata: overrides.metadata ?? {},
      // biome-ignore lint/style/useNamingConvention: the Stripe wire field
      client_secret: `${id}_secret_test`,
      // biome-ignore lint/style/useNamingConvention: the Stripe wire field
      last_payment_error: null,
      ...(overrides.customer ? { customer: overrides.customer } : {}),
      // biome-ignore lint/style/useNamingConvention: the Stripe wire field
      ...(overrides.setupFutureUsage ? { setup_future_usage: overrides.setupFutureUsage } : {}),
      // biome-ignore lint/style/useNamingConvention: the Stripe wire field
      payment_method: overrides.paymentMethod ?? MOCK_PAYMENT_METHOD_ID,
    }
  },

  customer(
    overrides: {
      id?: string
      email?: string
      name?: string
      metadata?: Record<string, string>
      defaultPaymentMethod?: string | null
    } = {},
  ) {
    return {
      id: overrides.id ?? MOCK_CUSTOMER_ID,
      object: 'customer',
      email: overrides.email ?? 'shopper@example.com',
      name: overrides.name ?? 'Test Shopper',
      metadata: overrides.metadata ?? {},
      // biome-ignore lint/style/useNamingConvention: the Stripe wire field
      invoice_settings: { default_payment_method: overrides.defaultPaymentMethod ?? null },
    }
  },

  /**
   * A stored card. `allow_redisplay` defaults to `always` because every listing filters on it —
   * the `unspecified` case is what `markRedisplayable` exists to fix, and it has its own handler.
   */
  paymentMethod(
    overrides: {
      id?: string
      customer?: string | null
      /** Seconds, as Stripe counts. The wallet's "most recent" ordering reads this. */
      created?: number
      brand?: string
      last4?: string
      expMonth?: number
      expYear?: number
      allowRedisplay?: AllowRedisplay
    } = {},
  ) {
    return {
      id: overrides.id ?? MOCK_PAYMENT_METHOD_ID,
      object: 'payment_method',
      type: 'card',
      customer: overrides.customer === undefined ? MOCK_CUSTOMER_ID : overrides.customer,
      // biome-ignore lint/style/useNamingConvention: the Stripe wire field
      allow_redisplay: overrides.allowRedisplay ?? 'always',
      created: overrides.created ?? 1_767_225_600,
      card: {
        brand: overrides.brand ?? 'visa',
        last4: overrides.last4 ?? '4242',
        // biome-ignore lint/style/useNamingConvention: the Stripe wire field
        exp_month: overrides.expMonth ?? 12,
        // biome-ignore lint/style/useNamingConvention: the Stripe wire field
        exp_year: overrides.expYear ?? 2030,
      },
    }
  },

  refund(overrides: Record<string, string> = {}) {
    return { id: 're_test_mock', object: 'refund', status: 'succeeded', ...overrides }
  },

  deletedCustomer(id: string) {
    return { id, object: 'customer', deleted: true }
  },

  list<TItem>(data: TItem[]) {
    // biome-ignore lint/style/useNamingConvention: the Stripe wire field
    return { object: 'list', data, has_more: false }
  },

  /** Stripe's error envelope, so the adapter's classification runs against the real shape. */
  cardDeclined(declineCode = 'generic_decline') {
    return {
      error: {
        type: 'card_error',
        code: 'card_declined',
        // biome-ignore lint/style/useNamingConvention: the Stripe wire field
        decline_code: declineCode,
        message: 'Your card was declined.',
      },
    }
  },

  /**
   * What `customers.retrievePaymentMethod` answers for a method that is not this customer's — or
   * is not there at all.
   *
   * A bare 404: no `code`, no `param`, because Stripe will not confirm that another customer's
   * payment method is real. The absence is load-bearing rather than incidental — `errors.ts`
   * reads "404 with no code" as *the* ownership answer, so a refusal carrying `resource_missing`
   * here is classified as our own bug and answered with a 500 instead of the wallet's 409.
   */
  notYourPaymentMethod() {
    return { error: { type: 'invalid_request_error', message: 'No such payment_method' } }
  },

  noSuchResource(kind: string, id: string) {
    return {
      error: { type: 'invalid_request_error', code: 'resource_missing', message: `No such ${kind}: '${id}'` },
    }
  },
}

/** A stored card as the gateway holds it — what `stripeFactories.paymentMethod` builds. */
export type StripeCard = ReturnType<typeof stripeFactories.paymentMethod>
