import type { StripeFailureLog } from './adapters/stripe/errors'

/**
 * The one place the storefront writes down a payment failure.
 *
 * Everything the shopper was not told goes here: the decline code that `lost_card` and
 * `generic_decline` are told apart by, and the dashboard link that opens the exact request. It is
 * a function rather than a bare `console.error` at each call site so there is one seam to replace.
 *
 * TODO(monitoring): the store has no error-reporting transport, so this reaches the browser
 * console and nothing else. Point it at one when it lands — the callers do not change.
 */
export function logPaymentFailure(message: string, fields: StripeFailureLog | Record<string, unknown>): void {
  // biome-ignore lint/suspicious/noConsole: this is the store's payment log; see the TODO above
  console.error(`[payment] ${message}`, fields)
}
