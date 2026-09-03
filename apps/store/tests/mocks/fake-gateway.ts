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
