import { describe, expect, test } from 'vitest'
import { paymentProviderDeclarations } from '../provider-declarations.js'

describe('paymentProviderDeclarations', () => {
  test('declares Stripe only when the store turned it on', () => {
    expect(paymentProviderDeclarations({ payment: [], notification: [] }).providers).toEqual([])

    const declared = paymentProviderDeclarations({ payment: ['stripe'], notification: [] }).providers ?? []
    expect(declared.map((provider) => provider.id)).toEqual(['default'])
  })
})
