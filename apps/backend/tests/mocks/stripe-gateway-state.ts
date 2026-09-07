/**
 * The fake Stripe gateway's state, shared by the two halves that need it.
 *
 * The MSW handlers below the server answer the backend's calls to `api.stripe.com`; the control
 * server (`fake-gateway-server.ts`) exposes the same state over HTTP so the browser's fake
 * Stripe.js and the Playwright specs can read and advance it. Both halves have to agree about an
 * intent or the e2e flow would confirm one payment and authorize a different one.
 *
 * Only reachable with `MOCKS=true`, which is the e2e server and nothing else.
 */

export type FakeIntentStatus =
  | 'requires_payment_method'
  | 'requires_confirmation'
  | 'requires_action'
  | 'processing'
  | 'requires_capture'
  | 'succeeded'
  | 'canceled'

export type FakeIntent = {
  id: string
  object: 'payment_intent'
  status: FakeIntentStatus
  amount: number
  // biome-ignore lint/style/useNamingConvention: the Stripe wire field
  amount_received: number
  // biome-ignore lint/style/useNamingConvention: the Stripe wire field
  amount_capturable: number
  currency: string
  // biome-ignore lint/style/useNamingConvention: the Stripe wire field
  capture_method: string
  metadata: Record<string, string>
  // biome-ignore lint/style/useNamingConvention: the Stripe wire field
  client_secret: string
  // biome-ignore lint/style/useNamingConvention: the Stripe wire field
  last_payment_error: {
    type: string
    code?: string
    // biome-ignore lint/style/useNamingConvention: the Stripe wire field
    decline_code?: string
    message?: string
    // biome-ignore lint/style/useNamingConvention: the Stripe wire field
    request_log_url?: string
  } | null
  /** The account holder the intent was opened against, when there was one. */
  customer?: string
  /** Set when the shopper consented to keep the card they are paying with. */
  // biome-ignore lint/style/useNamingConvention: the Stripe wire field
  setup_future_usage?: string
  /** The method the intent was confirmed with — a saved card's id, or the one just attached. */
  // biome-ignore lint/style/useNamingConvention: the Stripe wire field
  payment_method?: string
}

/**
 * What Stripe stores against a customer once a card has been attached to them.
 *
 * `allow_redisplay` starts at `unspecified` for a card attached through `setup_future_usage`,
 * which is the trap the adapter exists to close: the customer-scoped listing filters that value
 * straight back out, so a card can be saved in the sense that nobody can ever see it.
 */
export type FakePaymentMethod = {
  id: string
  object: 'payment_method'
  type: 'card'
  customer: string | null
  // biome-ignore lint/style/useNamingConvention: the Stripe wire field
  allow_redisplay: 'always' | 'limited' | 'unspecified'
  /** Seconds, as Stripe counts. The wallet's "most recent" ordering reads this. */
  created: number
  card: {
    brand: string
    last4: string
    // biome-ignore lint/style/useNamingConvention: the Stripe wire field
    exp_month: number
    // biome-ignore lint/style/useNamingConvention: the Stripe wire field
    exp_year: number
  }
}

export type FakeCustomer = {
  id: string
  object: 'customer'
  email?: string
  name?: string
  metadata: Record<string, string>
  // biome-ignore lint/style/useNamingConvention: the Stripe wire field
  invoice_settings: { default_payment_method: string | null }
}

/** One recorded call at the gateway boundary. `index` is what a spec takes a watermark from. */
export type GatewayCall = {
  index: number
  method: string
  params: Record<string, unknown>
  idempotencyKey: string | null
}

const intents = new Map<string, FakeIntent>()
const customers = new Map<string, FakeCustomer>()
const methods = new Map<string, FakePaymentMethod>()
const calls: GatewayCall[] = []
let nextIntentId = 0
let nextCustomerId = 0
let nextMethodId = 0
/**
 * A monotonic `created` stamp, so "most recent first" is insertion order.
 *
 * Wall-clock seconds are too coarse: two cards seeded in the same test land in the same second,
 * and the wallet's ordering tiebreak would then depend on Map iteration rather than on the order
 * the test wrote them.
 */
let nextCreatedAt = Math.floor(Date.UTC(2026, 0, 1) / 1000)

export function recordCall(method: string, params: Record<string, unknown>, idempotencyKey: string | null): void {
  calls.push({ index: calls.length, method, params, idempotencyKey })
}

/** Everything recorded from `since` onward, plus the watermark to pass to the next read. */
export function callsSince(since: number): { calls: GatewayCall[]; nextIndex: number } {
  return { calls: calls.slice(since), nextIndex: calls.length }
}

export function getIntent(id: string): FakeIntent | undefined {
  return intents.get(id)
}

/** The intent opened for a payment session, found the way Stripe would — through the metadata. */
export function getIntentForSession(sessionId: string): FakeIntent | undefined {
  return [...intents.values()].find((intent) => intent.metadata.sessionId === sessionId)
}

/** What Stripe reports as received and as capturable for an intent in a given state. */
export function settledAmounts(status: FakeIntentStatus, amount: number) {
  return {
    // biome-ignore lint/style/useNamingConvention: the Stripe wire field
    amount_received: status === 'succeeded' ? amount : 0,
    // biome-ignore lint/style/useNamingConvention: the Stripe wire field
    amount_capturable: status === 'requires_capture' ? amount : 0,
  }
}

export function createIntent(params: {
  amount: number
  currency: string
  metadata: Record<string, string>
  captureMethod: string
  customer?: string
  setupFutureUsage?: string
  paymentMethod?: string
}): FakeIntent {
  nextIntentId += 1
  const id = `pi_fake_${nextIntentId}`
  const status: FakeIntentStatus = 'requires_payment_method'
  const intent: FakeIntent = {
    id,
    object: 'payment_intent',
    status,
    amount: params.amount,
    currency: params.currency,
    // biome-ignore lint/style/useNamingConvention: the Stripe wire field
    capture_method: params.captureMethod,
    metadata: params.metadata,
    // biome-ignore lint/style/useNamingConvention: the Stripe wire field
    client_secret: `${id}_secret_fake`,
    // biome-ignore lint/style/useNamingConvention: the Stripe wire field
    last_payment_error: null,
    ...settledAmounts(status, params.amount),
    ...(params.customer ? { customer: params.customer } : {}),
    // biome-ignore lint/style/useNamingConvention: the Stripe wire field
    ...(params.setupFutureUsage ? { setup_future_usage: params.setupFutureUsage } : {}),
    // biome-ignore lint/style/useNamingConvention: the Stripe wire field
    ...(params.paymentMethod ? { payment_method: params.paymentMethod } : {}),
  }
  intents.set(id, intent)
  return intent
}

/**
 * Moves an intent to the state a browser confirmation left it in.
 *
 * The browser confirms against Stripe directly, so without this the server would authorize an
 * intent it had never seen confirmed — and the e2e would prove nothing about the sequence.
 */
export function advanceIntent(
  id: string,
  status: FakeIntentStatus,
  lastPaymentError: FakeIntent['last_payment_error'] = null,
  /** The card the browser confirmed with, when it collected one. */
  card?: CardDetails,
): FakeIntent | undefined {
  const intent = intents.get(id)
  if (!intent) return undefined

  intent.status = status
  intent.last_payment_error = lastPaymentError
  Object.assign(intent, settledAmounts(status, intent.amount))
  attachConfirmedCard(intent, card)
  return intent
}

export type CardDetails = { brand: string; last4: string; expMonth: number; expYear: number }

/**
 * The other half of "a card is saved by paying with it".
 *
 * A confirmation against a customer with `setup_future_usage` attaches the method, and Stripe
 * leaves it `unspecified` — the server has to set `allow_redisplay` afterwards or the card is
 * invisible to every listing. Modelled rather than shortcut, because that gap is exactly what the
 * adapter's `markRedisplayable` exists to close and a fake that pre-set it would prove nothing.
 */
function attachConfirmedCard(intent: FakeIntent, card?: CardDetails): void {
  if (!card || intent.payment_method || !CONFIRMED_STATUSES.has(intent.status)) return

  const method = createPaymentMethod({
    ...card,
    // A card only survives the payment when the shopper asked for it to; otherwise it belongs to
    // this intent and nothing else.
    customer: intent.setup_future_usage ? (intent.customer ?? null) : null,
    allowRedisplay: 'unspecified',
  })
  intent.payment_method = method.id
}

/** The states in which the browser has confirmed the intent with a card. */
const CONFIRMED_STATUSES: ReadonlySet<FakeIntentStatus> = new Set(['requires_capture', 'succeeded', 'processing'])

// -- Customers and their stored cards ----------------------------------------------------------

export function createCustomer(params: { email?: string; name?: string; metadata?: Record<string, string> }) {
  nextCustomerId += 1
  const customer: FakeCustomer = {
    id: `cus_fake_${nextCustomerId}`,
    object: 'customer',
    ...(params.email ? { email: params.email } : {}),
    ...(params.name ? { name: params.name } : {}),
    metadata: params.metadata ?? {},
    // biome-ignore lint/style/useNamingConvention: the Stripe wire field
    invoice_settings: { default_payment_method: null },
  }
  customers.set(customer.id, customer)
  return customer
}

export function getCustomer(id: string): FakeCustomer | undefined {
  return customers.get(id)
}

/**
 * The gateway customer standing for a Proteus customer, found through the metadata the adapter
 * writes. The link a spec needs to seed a wallet without going through a purchase first.
 */
export function findCustomerForProteusCustomer(customerId: string): FakeCustomer | undefined {
  return [...customers.values()].find((customer) => customer.metadata.customerId === customerId)
}

export function updateCustomer(
  id: string,
  params: { email?: string; name?: string; defaultPaymentMethod?: string },
): FakeCustomer | undefined {
  const customer = customers.get(id)
  if (!customer) return undefined

  if (params.email !== undefined) customer.email = params.email
  if (params.name !== undefined) customer.name = params.name
  if (params.defaultPaymentMethod !== undefined) {
    customer.invoice_settings.default_payment_method = params.defaultPaymentMethod
  }
  return customer
}

export function deleteCustomer(id: string): boolean {
  return customers.delete(id)
}

export function createPaymentMethod(params: {
  customer: string | null
  brand: string
  last4: string
  expMonth: number
  expYear: number
  allowRedisplay?: FakePaymentMethod['allow_redisplay']
}): FakePaymentMethod {
  nextMethodId += 1
  nextCreatedAt += 1

  const method: FakePaymentMethod = {
    id: `pm_fake_${nextMethodId}`,
    object: 'payment_method',
    type: 'card',
    customer: params.customer,
    // biome-ignore lint/style/useNamingConvention: the Stripe wire field
    allow_redisplay: params.allowRedisplay ?? 'unspecified',
    created: nextCreatedAt,
    card: {
      brand: params.brand,
      last4: params.last4,
      // biome-ignore lint/style/useNamingConvention: the Stripe wire field
      exp_month: params.expMonth,
      // biome-ignore lint/style/useNamingConvention: the Stripe wire field
      exp_year: params.expYear,
    },
  }
  methods.set(method.id, method)
  return method
}

export function getPaymentMethod(id: string): FakePaymentMethod | undefined {
  return methods.get(id)
}

/**
 * A customer's cards, newest first and filtered the way the customer-scoped listing filters.
 *
 * Both halves matter: without `allow_redisplay` the listing returns cards the shopper never
 * consented to see again, and without the ordering the fake would hand back Map insertion order
 * and the module's own sort would look correct whatever it did.
 */
export function listPaymentMethodsFor(
  customerId: string,
  filter: { allowRedisplay?: string; limit?: number },
): FakePaymentMethod[] {
  const owned = [...methods.values()]
    .filter((method) => method.customer === customerId)
    .filter((method) => !filter.allowRedisplay || method.allow_redisplay === filter.allowRedisplay)
    .sort((a, b) => b.created - a.created)

  return filter.limit ? owned.slice(0, filter.limit) : owned
}

export function updatePaymentMethod(
  id: string,
  params: { allowRedisplay?: FakePaymentMethod['allow_redisplay'] },
): FakePaymentMethod | undefined {
  const method = methods.get(id)
  if (!method) return undefined

  if (params.allowRedisplay) method.allow_redisplay = params.allowRedisplay
  return method
}

/** Detach, as Stripe does it: the method survives, the link to the customer does not. */
export function detachPaymentMethod(id: string): FakePaymentMethod | undefined {
  const method = methods.get(id)
  if (!method) return undefined

  for (const customer of customers.values()) {
    if (customer.invoice_settings.default_payment_method === id) {
      customer.invoice_settings.default_payment_method = null
    }
  }
  method.customer = null
  return method
}

export function updateIntent(id: string, params: { amount?: number; currency?: string }): FakeIntent | undefined {
  const intent = intents.get(id)
  if (!intent) return undefined

  if (params.amount !== undefined) intent.amount = params.amount
  if (params.currency !== undefined) intent.currency = params.currency
  Object.assign(intent, settledAmounts(intent.status, intent.amount))
  return intent
}
