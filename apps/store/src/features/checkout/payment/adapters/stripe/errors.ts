import type { StripeError } from '@stripe/stripe-js'

/**
 * The fields both shapes of Stripe browser failure carry.
 *
 * `stripe.confirmPayment` rejects with a `StripeError`; a PaymentIntent that failed earlier
 * carries a `LastPaymentError`, which is the same object minus the fields only a live request
 * has. Naming the overlap lets one rule cover both, which matters because the bucketing must not
 * depend on which of the two the shopper happened to reach.
 */
export type StripeFailure = {
  type: StripeError['type']
  code?: string
  // biome-ignore lint/style/useNamingConvention: the Stripe wire field
  decline_code?: string
  message?: string
  // biome-ignore lint/style/useNamingConvention: the Stripe wire field
  request_log_url?: string
}

/**
 * Turning a Stripe error into something a shopper reads, and something an engineer can act on.
 *
 * Two pure functions, deliberately apart from the component that calls them: the bucketing rule
 * below is subtle enough that it deserves tests of its own rather than tests that reach it
 * through a rendered form.
 */

/** What every failure we cannot explain says. Never a gateway string. */
export const GENERIC_FAILURE_MESSAGE = 'We could not process your payment. Please try again or use a different card.'

/** The one string every issuer decline collapses to, except the four a shopper can act on. */
export const DECLINED_MESSAGE = 'Your card was declined. Please try another card or contact your bank.'

const AUTHENTICATION_FAILED_MESSAGE =
  'We could not authenticate your card with your bank. Please try again or use a different card.'

/**
 * The only issuer declines whose reason the shopper is told. Everything else collapses.
 *
 * An allow-list, and it has to be one. A deny-list naming the sensitive codes does not merge the
 * buckets, it swaps which one is the odd one out: a prober sends a stolen card, reads the generic
 * string, sends a random card, reads Stripe's own "Your card was declined." and separates them
 * exactly as before. A deny-list *plus* the obvious neighbours is no better — Stripe publishes
 * around thirty decline codes, and `pickup_card`, `restricted_card`, `security_violation`,
 * `stop_payment_order`, `card_velocity_exceeded` and `revocation_of_authorization` would each
 * still arrive in the shopper's hands with their own distinct wording. `pickup_card` is a common
 * mapping for a card reported lost or stolen, so the oracle survives the deny-list intact.
 *
 * These four are here because Stripe's message tells the shopper something they can do about it,
 * and none of them says anything about the card's history that the shopper does not already know.
 * Stripe.js rewrites decline messages in the browser and does so non-uniformly, which is why none
 * of this can be delegated to the SDK.
 */
const ACTIONABLE_DECLINE_CODES: ReadonlySet<string> = new Set([
  'insufficient_funds',
  'expired_card',
  'incorrect_cvc',
  'processing_error',
])

/**
 * The code Stripe uses for "the issuer said no". It is the only card error that carries a
 * `decline_code`, and the only one the rule above applies to.
 *
 * Every other `card_error` code — `incorrect_number`, `invalid_expiry_year`, `incomplete_cvc` and
 * the rest — is a fact about what the shopper typed, not an opinion the issuer holds about their
 * card. Those pass through: they carry nothing to probe for, and replacing "Your card number is
 * incorrect" with "Your card was declined" would send a shopper to their bank over a typo.
 */
const ISSUER_DECLINE_CODE = 'card_declined'

/**
 * What the shopper is told.
 *
 * Branches on `code` before `type`, and that order is load-bearing:
 * `payment_intent_authentication_failure` arrives as an `invalid_request_error`, not the
 * `card_error` you would expect, so branching on `type` alone tells a shopper who fumbled a 3D
 * Secure challenge that something unexpected happened.
 */
export function customerMessageForStripeError(error: StripeFailure | null | undefined): string {
  if (!error) return GENERIC_FAILURE_MESSAGE

  if (error.code === 'payment_intent_authentication_failure') return AUTHENTICATION_FAILED_MESSAGE

  if (error.type === 'card_error') {
    if (error.code !== ISSUER_DECLINE_CODE) return error.message ?? DECLINED_MESSAGE

    const declineCode = error.decline_code
    if (declineCode && ACTIONABLE_DECLINE_CODES.has(declineCode)) return error.message ?? DECLINED_MESSAGE
    // Every other decline — named, unnamed, and every code Stripe adds after this is written.
    return DECLINED_MESSAGE
  }

  if (error.type === 'validation_error') return error.message ?? GENERIC_FAILURE_MESSAGE

  // api_error, api_connection_error, authentication_error, rate_limit_error, idempotency_error,
  // invalid_request_error. Every one of these is our problem, and their messages name our keys
  // and our resources — "Invalid API Key provided: sk_test_*****dkey" is a real one.
  return GENERIC_FAILURE_MESSAGE
}

/** Everything worth keeping about a failure, for the log that a support ticket is answered from. */
export type StripeFailureLog = {
  type: string
  code: string | null
  declineCode: string | null
  /** Opens the exact request in the Stripe dashboard. The most useful field here by far. */
  requestLogUrl: string | null
}

/**
 * What the log keeps.
 *
 * Everything the shopper was not told, so that a decline they could only describe vaguely is one
 * dashboard link away — and so that `lost_card` and `generic_decline`, identical on screen, stay
 * distinct here.
 */
export function logFieldsForStripeError(error: StripeFailure | null | undefined): StripeFailureLog {
  return {
    type: error?.type ?? 'unknown_error',
    code: error?.code ?? null,
    declineCode: error?.decline_code ?? null,
    requestLogUrl: error?.request_log_url ?? null,
  }
}
