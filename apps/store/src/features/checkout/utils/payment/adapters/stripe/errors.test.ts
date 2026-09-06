import { describe, expect, test } from 'vitest'
import {
  customerMessageForStripeError,
  DECLINED_MESSAGE,
  GENERIC_FAILURE_MESSAGE,
  logFieldsForStripeError,
  type StripeFailure,
} from './errors'

/**
 * The rule these functions encode is what stops the store being a card-testing oracle, and it is
 * subtle enough in two places to deserve tests that name the subtlety rather than the behaviour.
 */

const cardError = (declineCode?: string, message = 'Your card was declined.'): StripeFailure => ({
  type: 'card_error',
  code: 'card_declined',
  // biome-ignore lint/style/useNamingConvention: the Stripe wire field
  decline_code: declineCode,
  message,
})

describe('customerMessageForStripeError', () => {
  test('gives every sensitive decline the same string, including the one they collapse onto', () => {
    // The target is in the set too. Override only the four sensitive codes and the buckets are
    // not merged — the odd one out is swapped, and a prober separates them exactly as before.
    const sensitive = ['fraudulent', 'lost_card', 'stolen_card', 'merchant_blacklist']
    const ordinary = ['generic_decline', 'do_not_honor', 'call_issuer', 'transaction_not_allowed']

    const messages = new Set(
      [...sensitive, ...ordinary].map((code) =>
        // Stripe.js rewrites decline messages in the browser and does so non-uniformly, so each
        // arrives with its own wording. That wording is exactly what must not reach the shopper.
        customerMessageForStripeError(cardError(code, `Stripe's own wording for ${code}.`)),
      ),
    )

    expect(messages).toEqual(new Set([DECLINED_MESSAGE]))
  })

  /**
   * The test the deny-list version could not fail.
   *
   * Stripe publishes around thirty decline codes. Naming the sensitive ones and letting the rest
   * through leaves the oracle standing one code to the left: `pickup_card` is a common mapping
   * for a card reported lost or stolen, and under a deny-list it arrives with its own wording
   * while `generic_decline` arrives with another. Only an allow-list closes that.
   */
  test.each([
    ['pickup_card'],
    ['restricted_card'],
    ['security_violation'],
    ['stop_payment_order'],
    ['card_velocity_exceeded'],
    ['revocation_of_authorization'],
    ['a_code_stripe_has_not_published_yet'],
  ])('collapses the decline code %p, which no list names', (code) => {
    expect(customerMessageForStripeError(cardError(code, `Stripe's own wording for ${code}.`))).toBe(DECLINED_MESSAGE)
  })

  test('is indistinguishable across every decline but the four a shopper can act on', () => {
    // The whole rule in one assertion: hand it Stripe's distinct wording for a spread of codes
    // and exactly one string comes back for all of them.
    const declines = [
      'generic_decline',
      'lost_card',
      'stolen_card',
      'pickup_card',
      'security_violation',
      'issuer_not_available',
      'try_again_later',
    ]

    const messages = new Set(
      declines.map((code) => customerMessageForStripeError(cardError(code, `Distinct: ${code}`))),
    )
    expect(messages.size).toBe(1)
  })

  test('reads identically for a lost card and a generic decline', () => {
    expect(customerMessageForStripeError(cardError('lost_card'))).toBe(
      customerMessageForStripeError(cardError('generic_decline')),
    )
  })

  test("passes Stripe's own message through for declines the shopper can act on", () => {
    const actionable: [string, string][] = [
      ['insufficient_funds', 'Your card has insufficient funds.'],
      ['expired_card', 'Your card has expired.'],
      ['incorrect_cvc', "Your card's security code is incorrect."],
      ['processing_error', 'An error occurred while processing your card. Try again in a little bit.'],
    ]

    for (const [code, message] of actionable) {
      expect(customerMessageForStripeError(cardError(code, message))).toBe(message)
    }

    // And the same codes are the only ones that get this treatment: swap one for a neighbour and
    // the shopper is told nothing about why.
    expect(
      customerMessageForStripeError(cardError('withdrawal_count_limit_exceeded', 'You have exceeded the balance')),
    ).toBe(DECLINED_MESSAGE)
  })

  test('leaves a mistyped card saying what was mistyped, not that the bank refused', () => {
    // Not an issuer decline: a `card_error` without `card_declined` is a fact about what the
    // shopper typed. Collapsing these would send someone to their bank over a typo, and they
    // carry nothing to probe for.
    const typed: [string, string][] = [
      ['incorrect_number', 'Your card number is incorrect.'],
      ['invalid_expiry_year', "Your card's expiration year is invalid."],
      ['incomplete_cvc', "Your card's security code is incomplete."],
    ]

    for (const [code, message] of typed) {
      expect(
        customerMessageForStripeError({ type: 'card_error', code, message }),
        `${code} should keep Stripe's own wording`,
      ).toBe(message)
    }
  })

  test('answers a failed 3D Secure challenge in its own terms, not as something unexpected', () => {
    // The trap: this arrives as an `invalid_request_error`, not the `card_error` you would
    // expect, so branching on `type` alone tells a shopper who fumbled a challenge that something
    // went wrong on our side. Branching on `code` first is what makes it right.
    const message = customerMessageForStripeError({
      type: 'invalid_request_error',
      code: 'payment_intent_authentication_failure',
      message: 'The provided PaymentMethod has failed authentication.',
    })

    expect(message).toContain('authenticate')
    expect(message).not.toBe(GENERIC_FAILURE_MESSAGE)
    expect(message).not.toBe(DECLINED_MESSAGE)
  })

  test('never lets an error of ours reach the shopper in our words', () => {
    // Two real strings this would otherwise forward. Both name our own credentials or resources.
    const ours: StripeFailure[] = [
      { type: 'authentication_error', message: 'Invalid API Key provided: sk_test_*****dkey' },
      { type: 'invalid_request_error', message: "No such PaymentMethod: 'pm_1JVFmtGCSCcgOfxvXsBg1Ldu'" },
      { type: 'api_error', message: 'An unexpected error occurred.' },
      { type: 'api_connection_error', message: 'Network error' },
      { type: 'rate_limit_error', message: 'Too many requests' },
      { type: 'idempotency_error', message: 'Keys for idempotent requests can only be used with the same parameters' },
    ]

    for (const error of ours) {
      expect(customerMessageForStripeError(error)).toBe(GENERIC_FAILURE_MESSAGE)
    }
  })

  test('says something rather than nothing when there is no error object at all', () => {
    expect(customerMessageForStripeError(undefined)).toBe(GENERIC_FAILURE_MESSAGE)
    expect(customerMessageForStripeError(null)).toBe(GENERIC_FAILURE_MESSAGE)
  })
})

describe('logFieldsForStripeError', () => {
  test('keeps what the shopper was not told', () => {
    expect(
      logFieldsForStripeError({
        type: 'card_error',
        code: 'card_declined',
        // biome-ignore lint/style/useNamingConvention: the Stripe wire field
        decline_code: 'lost_card',
        message: 'Your card was declined.',
        // biome-ignore lint/style/useNamingConvention: the Stripe wire field
        request_log_url: 'https://dashboard.stripe.com/test/logs/req_123',
      }),
    ).toEqual({
      type: 'card_error',
      code: 'card_declined',
      declineCode: 'lost_card',
      requestLogUrl: 'https://dashboard.stripe.com/test/logs/req_123',
    })
  })

  test('distinguishes the two declines that are indistinguishable on screen', () => {
    // The other half of the bucketing rule: what the shopper cannot tell apart, on-call can.
    const lost = logFieldsForStripeError(cardError('lost_card'))
    const generic = logFieldsForStripeError(cardError('generic_decline'))

    expect(customerMessageForStripeError(cardError('lost_card'))).toBe(
      customerMessageForStripeError(cardError('generic_decline')),
    )
    expect(lost.declineCode).not.toBe(generic.declineCode)
  })

  test('is safe to call on a failure that carried no detail', () => {
    expect(logFieldsForStripeError(undefined)).toEqual({
      type: 'unknown_error',
      code: null,
      declineCode: null,
      requestLogUrl: null,
    })
  })
})
