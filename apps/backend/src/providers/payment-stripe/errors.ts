import Stripe from 'stripe'
import { AppError, ErrorTypes } from '../../core/errors/app-error.js'

/**
 * Classifying what the gateway threw, and answering with a code instead of its message.
 *
 * **The trap this file exists for.** A browser `StripeError` is a plain object carrying one of
 * Stripe's error types on `.type`. A server `stripe-node` error is an `Error` subclass: `.type`
 * holds the *class* name — `'StripeCardError'` — and the type Stripe actually sent is on
 * `.rawType`. So `if (error.type === 'card_error')` compiles, runs, and silently never matches
 * on this side of the wire. Every classification below reads `rawType`.
 *
 * **Why the message never leaves.** Two real strings this boundary would otherwise forward are
 * `"Invalid API Key provided: sk_test_*****dkey"` and `"No such PaymentMethod: 'pm_…'"` — one
 * leaks our credential shape, the other confirms an id for anyone probing. The status code and
 * the `code` carry what the body must not, and the log keeps the rest.
 */

/** What a failure means for the caller. The buckets are wider than the status mapping: a card
 *  error and an idempotency error are both a 500, and telling them apart still matters in a log. */
export type GatewayErrorBucket =
  /** Connection or throttling. The same call, with the same idempotency key, may just work. */
  | 'retry'
  /** Stripe's own fault. The charge may have gone through, so this is indeterminate, not failed. */
  | 'indeterminate'
  /** A saved method that is gone, or was never this customer's. */
  | 'paymentMethod'
  /** The card was refused. Which decline it was is for the log, never for the shopper. */
  | 'card'
  /** Our bug or our configuration: a bad key, a malformed request, a reused idempotency key. */
  | 'fatal'

/** Everything a failure is worth keeping, and nothing that could be shown to a shopper. */
export type GatewayFailure = {
  /** Stripe's error type, read from `rawType` — never from `type`, which is the class name. */
  type: string | undefined
  code: string | undefined
  declineCode: string | undefined
  requestId: string | undefined
  /** Opens the exact request in the Stripe dashboard. The single most useful field here. */
  requestLogUrl: string | undefined
}

function isStripeError(error: unknown): error is Stripe.errors.StripeError {
  return error instanceof Stripe.errors.StripeError
}

/**
 * A method the shopper no longer has, or never had.
 *
 * Read from the named parameter rather than the message: Stripe says `No such PaymentMethod:
 * 'pm_…'`, and matching on that would both couple us to their copy and tempt someone into
 * forwarding it.
 */
function isPaymentMethodGone(error: Stripe.errors.StripeError): boolean {
  if (error.code === 'payment_method_unactivated') return true
  return error.code === 'resource_missing' && error.param === 'payment_method'
}

export function classifyGatewayError(error: unknown): GatewayErrorBucket {
  if (!isStripeError(error)) return 'fatal'

  // A connection failure is raised by `stripe-node` itself rather than parsed out of a response,
  // so it carries no `rawType` at all — its class is the only thing that identifies it. Throttling
  // is checked the same way because Stripe reports it under two different raw types depending on
  // the status code it arrives with, and the class covers both.
  if (error instanceof Stripe.errors.StripeConnectionError) return 'retry'
  if (error instanceof Stripe.errors.StripeRateLimitError) return 'retry'

  switch (error.rawType) {
    case 'rate_limit':
    case 'rate_limit_error':
      return 'retry'
    case 'api_error':
      return 'indeterminate'
    case 'card_error':
      return 'card'
    case 'invalid_request_error':
      return isPaymentMethodGone(error) ? 'paymentMethod' : 'fatal'
    default:
      return 'fatal'
  }
}

export function gatewayFailureOf(error: unknown): GatewayFailure {
  if (!isStripeError(error)) {
    return { type: undefined, code: undefined, declineCode: undefined, requestId: undefined, requestLogUrl: undefined }
  }

  return {
    type: error.rawType,
    code: error.code,
    declineCode: error.decline_code,
    requestId: error.requestId,
    requestLogUrl: error.request_log_url,
  }
}

/**
 * The one line a failure leaves behind. Every field the on-call engineer needs is here, because
 * none of them reach the shopper and the shopper is the only witness who will report the problem.
 */
export function gatewayFailureLog(operation: string, error: unknown): string {
  const failure = gatewayFailureOf(error)
  const bucket = classifyGatewayError(error)
  const fields = [
    `type=${failure.type ?? 'none'}`,
    `code=${failure.code ?? 'none'}`,
    `decline_code=${failure.declineCode ?? 'none'}`,
    `request_id=${failure.requestId ?? 'none'}`,
    `request_log_url=${failure.requestLogUrl ?? 'none'}`,
  ]
  return `[stripe] ${operation} failed (${bucket}): ${fields.join(' ')}`
}

/** Authored messages, one per bucket. None of them is Stripe's. */
const ANSWER_BY_BUCKET: Record<GatewayErrorBucket, { type: ErrorTypes; code: string; message: string }> = {
  retry: {
    type: ErrorTypes.SERVICE_UNAVAILABLE,
    code: 'payment_gateway_unavailable',
    message: 'The payment gateway is temporarily unavailable. Please try again.',
  },
  indeterminate: {
    type: ErrorTypes.SERVICE_UNAVAILABLE,
    code: 'payment_gateway_unavailable',
    message: 'The payment gateway is temporarily unavailable. Please try again.',
  },
  paymentMethod: {
    type: ErrorTypes.CONFLICT,
    code: 'payment_method_unavailable',
    message: 'That payment method is no longer available.',
  },
  card: {
    type: ErrorTypes.UNEXPECTED_STATE,
    code: 'card_error',
    message: 'The card could not be charged.',
  },
  fatal: {
    type: ErrorTypes.UNEXPECTED_STATE,
    code: 'payment_gateway_error',
    message: 'The payment could not be processed.',
  },
}

/** Translates a gateway failure into the error the rest of the backend already knows how to answer. */
export function toAppError(error: unknown): AppError {
  const answer = ANSWER_BY_BUCKET[classifyGatewayError(error)]
  return new AppError({ type: answer.type, code: answer.code, message: answer.message })
}
