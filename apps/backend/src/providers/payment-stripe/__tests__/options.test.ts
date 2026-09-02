import { describe, expect, test } from 'vitest'
import { validateStripeOptions } from '../options.js'

describe('validateStripeOptions', () => {
  test('accepts a fully configured provider', () => {
    expect(() => validateStripeOptions('stripe', { apiKey: 'sk_test_x', webhookSecret: 'whsec_x' })).not.toThrow()
  })

  test.each([['apiKey'], ['webhookSecret']])('names the provider and the missing "%s"', (missing) => {
    const options: Record<string, unknown> = { apiKey: 'sk_test_x', webhookSecret: 'whsec_x' }
    delete options[missing]

    expect(() => validateStripeOptions('stripe', options)).toThrow(new RegExp(`"stripe".+"${missing}".+missing`))
  })

  test.each([[''], ['   '], [null], [42]])('rejects the malformed value %p', (value) => {
    expect(() => validateStripeOptions('stripe', { apiKey: value, webhookSecret: 'whsec_x' })).toThrow(/"apiKey"/)
  })
})
