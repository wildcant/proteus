/**
 * Canned Stripe objects, in the shapes the wire uses.
 *
 * Every field name here is Stripe's rather than this codebase's, so each literal needs a
 * `useNamingConvention` suppression. Keeping them in one file is what lets the handlers next door
 * read as a flat list, and gives the wire format a single definition to check against the docs.
 *
 * Pure and stateless. A factory takes the few fields a handler echoes back from the request and
 * fills in the rest; nothing is stored between calls, so no test can be affected by what another
 * test did. Where a flow needs a different outcome, the handler for it is exported from
 * `stripe.http.ts` and swapped in per test.
 */

/** Fixed ids. The fake answers for one intent, one customer and one card; that is the whole model. */
export const MOCK_INTENT_ID = 'pi_test_mock'
export const MOCK_CUSTOMER_ID = 'cus_test_mock'
export const MOCK_PAYMENT_METHOD_ID = 'pm_test_mock'

/**
 * Values the fake reads as instructions rather than as data.
 *
 * The same device Stripe itself uses: `4000000000000002` is not a card, it is "decline this". The
 * store e2e runs the real backend in its own process, so the only thing a spec there can vary is
 * what it puts *into* the checkout — the total it builds a cart to, and the id it puts in a
 * wallet. Encoding the outcome in those keeps every handler a pure function of its request, which
 * is what lets the e2e specs run `fullyParallel` against one backend.
 *
 * Exported through `backend/test` so the spec and the handler share one constant rather than two
 * magic numbers that have to be kept in step by hand.
 */
export const FAKE_GATEWAY = {
  /** A total the gateway confirms and keeps settling: its intent reads back as `processing`. */
  settlingTotalCents: 4277,
  /** The intent that total opens. Derived from the amount, so `retrieve` can answer without state. */
  settlingIntentId: 'pi_test_settling',
  /** A method id the gateway does not hold — a card detached in another tab, or never theirs. */
  goneMethodPrefix: 'pm_test_gone',
} as const

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
  paymentIntent(over: IntentOverrides = {}) {
    const id = over.id ?? MOCK_INTENT_ID
    const status = over.status ?? 'requires_payment_method'
    const amount = over.amount ?? 5000

    return {
      id,
      object: 'payment_intent',
      status,
      amount,
      // biome-ignore lint/style/useNamingConvention: the Stripe wire field
      amount_received: status === 'succeeded' ? amount : 0,
      // biome-ignore lint/style/useNamingConvention: the Stripe wire field
      amount_capturable: status === 'requires_capture' ? amount : 0,
      currency: over.currency ?? 'usd',
      // biome-ignore lint/style/useNamingConvention: the Stripe wire field
      capture_method: over.captureMethod ?? 'manual',
      metadata: over.metadata ?? {},
      // biome-ignore lint/style/useNamingConvention: the Stripe wire field
      client_secret: `${id}_secret_test`,
      // biome-ignore lint/style/useNamingConvention: the Stripe wire field
      last_payment_error: null,
      ...(over.customer ? { customer: over.customer } : {}),
      // biome-ignore lint/style/useNamingConvention: the Stripe wire field
      ...(over.setupFutureUsage ? { setup_future_usage: over.setupFutureUsage } : {}),
      // biome-ignore lint/style/useNamingConvention: the Stripe wire field
      payment_method: over.paymentMethod ?? MOCK_PAYMENT_METHOD_ID,
    }
  },

  customer(
    over: {
      id?: string
      email?: string
      name?: string
      metadata?: Record<string, string>
      defaultPaymentMethod?: string | null
    } = {},
  ) {
    return {
      id: over.id ?? MOCK_CUSTOMER_ID,
      object: 'customer',
      email: over.email ?? 'shopper@example.com',
      name: over.name ?? 'Test Shopper',
      metadata: over.metadata ?? {},
      // biome-ignore lint/style/useNamingConvention: the Stripe wire field
      invoice_settings: { default_payment_method: over.defaultPaymentMethod ?? null },
    }
  },

  /**
   * A stored card. `allow_redisplay` defaults to `always` because every listing filters on it —
   * the `unspecified` case is what `markRedisplayable` exists to fix, and it has its own handler.
   */
  paymentMethod(
    over: {
      id?: string
      customer?: string | null
      /** Seconds, as Stripe counts. The wallet's "most recent" ordering reads this. */
      created?: number
      brand?: string
      last4?: string
      expMonth?: number
      expYear?: number
      allowRedisplay?: 'always' | 'limited' | 'unspecified'
    } = {},
  ) {
    return {
      id: over.id ?? MOCK_PAYMENT_METHOD_ID,
      object: 'payment_method',
      type: 'card',
      customer: over.customer === undefined ? MOCK_CUSTOMER_ID : over.customer,
      // biome-ignore lint/style/useNamingConvention: the Stripe wire field
      allow_redisplay: over.allowRedisplay ?? 'always',
      created: over.created ?? 1_767_225_600,
      card: {
        brand: over.brand ?? 'visa',
        last4: over.last4 ?? '4242',
        // biome-ignore lint/style/useNamingConvention: the Stripe wire field
        exp_month: over.expMonth ?? 12,
        // biome-ignore lint/style/useNamingConvention: the Stripe wire field
        exp_year: over.expYear ?? 2030,
      },
    }
  },

  refund(over: Record<string, string> = {}) {
    return { id: 're_test_mock', object: 'refund', status: 'succeeded', ...over }
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
