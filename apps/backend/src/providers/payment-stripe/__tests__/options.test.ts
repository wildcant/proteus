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
})
