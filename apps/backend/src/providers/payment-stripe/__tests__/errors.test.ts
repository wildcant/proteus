import Stripe from 'stripe'
import { describe, expect, test } from 'vitest'
import { ErrorTypes } from '../../../core/errors/app-error.js'
import { classifyGatewayError, gatewayFailureLog, gatewayFailureOf, toAppError } from '../errors.js'

/**
 * Built the way `stripe-node` builds one: the type Stripe sent goes in `raw.type`, and the
 * constructor puts the *class* name on `.type`. Every test below depends on that split, because
 * reading `.type` is the mistake this module exists to prevent.
 */
function stripeError(
  Klass: new (raw: Record<string, unknown>) => Stripe.errors.StripeError,
  raw: Record<string, unknown>,
) {
  return new Klass(raw)
}

const cardDeclined = () =>
  stripeError(Stripe.errors.StripeCardError, {
    type: 'card_error',
    code: 'card_declined',
    // biome-ignore lint/style/useNamingConvention: the raw Stripe field name
    decline_code: 'lost_card',
    message: 'Your card was declined.',
    // biome-ignore lint/style/useNamingConvention: the raw Stripe field name
    request_log_url: 'https://dashboard.stripe.com/test/logs/req_declined',
    requestId: 'req_declined',
  })

describe('classifyGatewayError', () => {
  test('reads the error type from rawType, where stripe-node puts it', () => {
    const error = cardDeclined()

    // The assertion that makes the next one mean something: an implementation branching on
    // `.type` is comparing against this, and matches no error type there has ever been.
    expect(error.type).toBe('StripeCardError')
    expect(error.rawType).toBe('card_error')

    expect(classifyGatewayError(error)).toBe('card')
  })

  test('classifies a payment method that is gone as its own bucket, not a generic bad request', () => {
    const error = stripeError(Stripe.errors.StripeInvalidRequestError, {
      type: 'invalid_request_error',
      code: 'resource_missing',
      param: 'payment_method',
      message: "No such PaymentMethod: 'pm_1234'",
    })

    expect(classifyGatewayError(error)).toBe('paymentMethod')
  })

  test('classifies an unrelated invalid request as fatal', () => {
    const error = stripeError(Stripe.errors.StripeInvalidRequestError, {
      type: 'invalid_request_error',
      code: 'parameter_unknown',
      param: 'nonsense',
    })

    expect(classifyGatewayError(error)).toBe('fatal')
  })

  test('classifies a connection failure as retriable even though it carries no rawType', () => {
    // stripe-node raises this one itself, so `raw.type` is never set and the class is the only
    // thing identifying it. A classifier reading rawType alone would call this fatal.
    const error = stripeError(Stripe.errors.StripeConnectionError, { message: 'socket hang up' })

    expect(error.rawType).toBeUndefined()
    expect(classifyGatewayError(error)).toBe('retry')
  })

  test('classifies throttling as retriable', () => {
    const error = stripeError(Stripe.errors.StripeRateLimitError, { type: 'rate_limit_error', statusCode: 429 })

    expect(classifyGatewayError(error)).toBe('retry')
  })

  test("classifies Stripe's own failure as indeterminate, because the charge may have landed", () => {
    const error = stripeError(Stripe.errors.StripeAPIError, { type: 'api_error', statusCode: 500 })

    expect(classifyGatewayError(error)).toBe('indeterminate')
  })

  test('classifies a bad API key as fatal — retrying will not fix a credential', () => {
    const error = stripeError(Stripe.errors.StripeAuthenticationError, {
      type: 'authentication_error',
      message: 'Invalid API Key provided: sk_test_*****dkey',
    })

    expect(classifyGatewayError(error)).toBe('fatal')
  })

  test('classifies something that is not a Stripe error at all as fatal', () => {
    expect(classifyGatewayError(new TypeError('undefined is not a function'))).toBe('fatal')
  })
})

describe('toAppError', () => {
  test('answers a stale payment method with a conflict the client can act on', () => {
    const error = toAppError(
      stripeError(Stripe.errors.StripeInvalidRequestError, {
        type: 'invalid_request_error',
        code: 'resource_missing',
        param: 'payment_method',
        message: "No such PaymentMethod: 'pm_1234'",
      }),
    )

    expect(error.type).toBe(ErrorTypes.CONFLICT)
    expect(error.code).toBe('payment_method_unavailable')
    expect(error.message).not.toContain('pm_1234')
  })

  test('answers a transient gateway failure with service unavailable', () => {
    const error = toAppError(stripeError(Stripe.errors.StripeConnectionError, { message: 'socket hang up' }))

    expect(error.type).toBe(ErrorTypes.SERVICE_UNAVAILABLE)
    expect(error.code).toBe('payment_gateway_unavailable')
  })

  test('answers anything else with an unexpected state, and never with the gateway message', () => {
    const error = toAppError(
      stripeError(Stripe.errors.StripeAuthenticationError, {
        type: 'authentication_error',
        message: 'Invalid API Key provided: sk_test_*****dkey',
      }),
    )

    expect(error.type).toBe(ErrorTypes.UNEXPECTED_STATE)
    expect(error.code).toBe('payment_gateway_error')
    expect(error.message).not.toContain('sk_test')
  })
})

describe('gatewayFailureLog', () => {
  test('keeps every field an on-call engineer needs to find the request', () => {
    const line = gatewayFailureLog('capturePayment', cardDeclined())

    expect(line).toContain('type=card_error')
    expect(line).toContain('code=card_declined')
    expect(line).toContain('decline_code=lost_card')
    expect(line).toContain('request_log_url=https://dashboard.stripe.com/test/logs/req_declined')
    expect(line).toContain('capturePayment')
  })

  test('names the missing fields rather than logging "undefined"', () => {
    const line = gatewayFailureLog('initiatePayment', new TypeError('boom'))

    expect(line).toContain('type=none')
    expect(line).toContain('decline_code=none')
  })
})

describe('gatewayFailureOf', () => {
  test('reads the decline code Stripe sent, which the shopper is never told', () => {
    expect(gatewayFailureOf(cardDeclined())).toMatchObject({
      type: 'card_error',
      code: 'card_declined',
      declineCode: 'lost_card',
      requestLogUrl: 'https://dashboard.stripe.com/test/logs/req_declined',
    })
  })
})
