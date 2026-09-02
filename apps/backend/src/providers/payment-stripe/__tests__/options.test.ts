import { describe, expect, test } from 'vitest'
import { validateStripeOptions } from '../options.js'

/** Everything the adapter needs before it will start. */
const complete = { apiKey: 'sk_test_x', webhookSecret: 'whsec_x', publishableKey: 'pk_test_x' }

describe('validateStripeOptions', () => {
  test('accepts a fully configured provider', () => {
    expect(() => validateStripeOptions('stripe', { ...complete })).not.toThrow()
  })

  test.each([['apiKey'], ['webhookSecret'], ['publishableKey']])(
    'names the provider and the missing "%s"',
    (missing) => {
      const options: Record<string, unknown> = { ...complete }
      delete options[missing]

      expect(() => validateStripeOptions('stripe', options)).toThrow(new RegExp(`"stripe".+"${missing}".+missing`))
    },
  )

  test.each([[''], ['   '], [null], [42]])('rejects the malformed value %p', (value) => {
    expect(() => validateStripeOptions('stripe', { ...complete, apiKey: value })).toThrow(/"apiKey"/)
  })

  /**
   * The swap this exists for: a key-holder adding `STRIPE_PUBLISHABLE_KEY` to a `.env`, on the
   * line below `STRIPE_SECRET_KEY`, pastes the wrong one. `GET /store/payment-providers` is
   * public, so nothing downstream would catch it — the provider boots and the key goes on the
   * wire to every browser.
   */
  test.each([['sk_test_51H8sample'], ['rk_live_restricted'], ['whsec_notakeyatall']])(
    'refuses to start on %p in publishableKey, which is served to every browser',
    (value) => {
      expect(() => validateStripeOptions('stripe', { ...complete, publishableKey: value })).toThrow(
        /"stripe".+"publishableKey".+"pk_"/,
      )
    },
  )

  test('does not print the value it rejected', () => {
    // The branch most likely to be holding a secret is the one that must not echo it into a
    // deploy log.
    const secret = 'sk_test_51HdoNotLogMe'
    expect(() => validateStripeOptions('stripe', { ...complete, publishableKey: secret })).toThrow(
      expect.not.stringContaining(secret),
    )
  })

  test.each([['pk_test_51H8sample'], ['pk_live_51H8sample']])('accepts the real shape %p', (value) => {
    expect(() => validateStripeOptions('stripe', { ...complete, publishableKey: value })).not.toThrow()
  })
})
