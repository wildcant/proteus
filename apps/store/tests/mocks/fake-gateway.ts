import type { Page } from '@playwright/test'
import { FAKE_GATEWAY_URL, FAKE_STRIPE_JS } from './fake-stripe-js'

/** One recorded call at the gateway boundary, as the fake gateway's control server reports it. */
export type GatewayCall = {
  index: number
  method: string
  params: Record<string, string>
  idempotencyKey: string | null
}

/**
 * Serves the fake Stripe.js in place of the real script.
 *
 * `loadStripe` injects `<script src="https://js.stripe.com/…">` and then reads `window.Stripe`,
 * so replacing the response is the whole of it — the adapter under test is not modified, mocked
 * or branched on in any way.
 */
export async function useFakeStripe(page: Page): Promise<void> {
  await page.route('https://js.stripe.com/**', (route) =>
    route.fulfill({ status: 200, contentType: 'application/javascript', body: FAKE_STRIPE_JS }),
  )
}

/**
 * A read of the gateway's own call log.
 *
 * Reads are watermarked rather than reset: the log is one object in the test server's process, so
 * a reset would wipe a neighbouring spec's evidence out from under it. Take a watermark, do the
 * thing, and read what happened since.
 */
export async function gatewayWatermark(): Promise<number> {
  const { nextIndex } = await readCalls(0)
  return nextIndex
}

export async function gatewayCallsSince(since: number): Promise<GatewayCall[]> {
  const { calls } = await readCalls(since)
  return calls
}

async function readCalls(since: number): Promise<{ calls: GatewayCall[]; nextIndex: number }> {
  const response = await fetch(`${FAKE_GATEWAY_URL}/calls?since=${since}`)
  if (!response.ok) throw new Error(`Fake gateway control server answered ${response.status}`)
  return (await response.json()) as { calls: GatewayCall[]; nextIndex: number }
}

/** An intent as the gateway holds it now — what an authorization looks like from the outside. */
export type GatewayIntent = {
  id: string
  status: string
  amount: number
  // biome-ignore lint/style/useNamingConvention: the Stripe wire field
  amount_capturable: number
}

/** Found through the session id in its metadata, the same link the adapter relies on. */
export async function gatewayIntentForSession(sessionId: string): Promise<GatewayIntent> {
  const response = await fetch(`${FAKE_GATEWAY_URL}/intents?sessionId=${encodeURIComponent(sessionId)}`)
  if (!response.ok) throw new Error(`Fake gateway has no intent for session "${sessionId}"`)
  return (await response.json()) as GatewayIntent
}

/** The intents created since a watermark, which is what "no PaymentIntent exists yet" reads. */
export async function intentsCreatedSince(since: number): Promise<GatewayCall[]> {
  const calls = await gatewayCallsSince(since)
  return calls.filter((call) => call.method === 'paymentIntents.create')
}

/** A stored card as the fake gateway holds it. The wire shape, so the fields are Stripe's. */
export type GatewayPaymentMethod = {
  id: string
  customer: string | null
  // biome-ignore lint/style/useNamingConvention: the Stripe wire field
  allow_redisplay: 'always' | 'limited' | 'unspecified'
  card: {
    brand: string
    last4: string
    // biome-ignore lint/style/useNamingConvention: the Stripe wire field
    exp_month: number
    // biome-ignore lint/style/useNamingConvention: the Stripe wire field
    exp_year: number
  }
}

export type GatewayCustomer = {
  id: string
  // biome-ignore lint/style/useNamingConvention: the Stripe wire field
  invoice_settings: { default_payment_method: string | null }
}

/**
 * The gateway customer standing for a Proteus customer.
 *
 * Nothing exists at the gateway until a shopper reaches a surface that needs an account holder, so
 * a spec calls this *after* loading the wallet or the payment step — which is also the assertion
 * that the account holder was created lazily rather than at signup.
 */
export async function gatewayCustomerFor(proteusCustomerId: string): Promise<GatewayCustomer> {
  const response = await fetch(`${FAKE_GATEWAY_URL}/customers?customerId=${encodeURIComponent(proteusCustomerId)}`)
  if (!response.ok) {
    throw new Error(`The fake gateway holds no customer for "${proteusCustomerId}" — has the wallet been loaded yet?`)
  }
  return (await response.json()) as GatewayCustomer
}

/**
 * Puts a card in a shopper's wallet without making them buy something for it.
 *
 * Seeded straight at the gateway rather than through the UI, because the states these specs need —
 * expired, expiring this month, a default that is not the newest — cannot be produced by paying
 * and would take a purchase each if they could. The save-at-checkout path has its own spec, which
 * is where "a card is saved by paying with it" is actually proved.
 *
 * `last4` must be unique per test: every spec here operates on a list of near-identical rows, and
 * the row a test asserts on has to be the row that test created.
 */
export async function seedSavedCard(
  gatewayCustomerId: string,
  card: { brand?: string; last4: string; expMonth: number; expYear: number; isDefault?: boolean },
): Promise<GatewayPaymentMethod> {
  const response = await fetch(`${FAKE_GATEWAY_URL}/customers/${gatewayCustomerId}/payment-methods`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ brand: 'visa', ...card }),
  })
  if (!response.ok) throw new Error(`The fake gateway refused the seeded card: ${response.status}`)
  return (await response.json()) as GatewayPaymentMethod
}

/**
 * The cards attached to a customer at the gateway, unfiltered by `allow_redisplay`.
 *
 * Unfiltered on purpose: a card saved through `setup_future_usage` lands as `unspecified` and the
 * customer-scoped listing hides it, so a spec asserting that the server made it redisplayable has
 * to be able to see it either way. A detached card is absent entirely — detach unlinks it.
 */
export async function gatewayWalletFor(gatewayCustomerId: string): Promise<GatewayPaymentMethod[]> {
  const response = await fetch(`${FAKE_GATEWAY_URL}/customers/${gatewayCustomerId}/payment-methods`)
  if (!response.ok) throw new Error(`The fake gateway holds no customer "${gatewayCustomerId}"`)
  return (await response.json()) as GatewayPaymentMethod[]
}
