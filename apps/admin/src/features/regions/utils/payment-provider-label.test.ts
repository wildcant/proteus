import { describe, expect, test } from 'vitest'
import { paymentProviderLabel } from './payment-provider-label'

describe('paymentProviderLabel', () => {
  test('names the gateway, not the configured instance of it', () => {
    expect(paymentProviderLabel('pp_stripe_default')).toBe('Stripe')
    expect(paymentProviderLabel('pp_system_default')).toBe('System')
  })

  test('reads a multi-word identifier as words', () => {
    expect(paymentProviderLabel('pp_mercado_pago_default')).toBe('Mercado Pago')
  })

  test('falls back to the whole id when it is not shaped like a provider id', () => {
    // A gateway this admin has never heard of is still one the merchant may have to recognise.
    expect(paymentProviderLabel('legacy')).toBe('Legacy')
  })
})
