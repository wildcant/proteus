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
  last_payment_error: { type: string; code?: string; decline_code?: string; message?: string } | null
}

/** One recorded call at the gateway boundary. `index` is what a spec takes a watermark from. */
export type GatewayCall = {
  index: number
  method: string
  params: Record<string, unknown>
  idempotencyKey: string | null
}

const intents = new Map<string, FakeIntent>()
const calls: GatewayCall[] = []
let nextIntentId = 0

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
): FakeIntent | undefined {
  const intent = intents.get(id)
  if (!intent) return undefined

  intent.status = status
  intent.last_payment_error = lastPaymentError
  Object.assign(intent, settledAmounts(status, intent.amount))
  return intent
}

export function updateIntent(id: string, params: { amount?: number; currency?: string }): FakeIntent | undefined {
  const intent = intents.get(id)
  if (!intent) return undefined

  if (params.amount !== undefined) intent.amount = params.amount
  if (params.currency !== undefined) intent.currency = params.currency
  Object.assign(intent, settledAmounts(intent.status, intent.amount))
  return intent
}
