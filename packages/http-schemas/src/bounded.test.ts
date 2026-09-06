import { describe, expect, it } from 'vitest'
import type { z } from 'zod'
import { AdminSetProductOptions } from './admin/product-option/payloads.js'
import { AdminCreateProductVariantsBatch } from './admin/product-variant/payloads.js'
import {
  countryCode,
  decimalAmount,
  entityId,
  httpUrl,
  longText,
  MAX_ITEMS,
  MAX_LENGTH,
  machineCode,
  opaqueToken,
  password,
  phone,
  postalCode,
  shortText,
  textBlob,
} from './bounded.js'
import { CreateCart } from './store/cart/payloads.js'

/**
 * Keyed by `MAX_LENGTH` rather than listed loosely: the type makes a kind without a primitive,
 * or a primitive without a kind, a compile error rather than an untested ceiling.
 */
const primitives: Record<keyof typeof MAX_LENGTH, z.ZodString> = {
  id: entityId,
  code: machineCode,
  shortText,
  longText,
  textBlob,
  url: httpUrl,
  password,
  token: opaqueToken,
  phone,
  postalCode,
  countryCode,
}

describe('bounded string primitives', () => {
  it.each(Object.entries(primitives))('%s stops one character past its ceiling', (kind, schema) => {
    const max = MAX_LENGTH[kind as keyof typeof MAX_LENGTH]

    expect(schema.safeParse('a'.repeat(max)).success).toBe(true)
    expect(schema.safeParse('a'.repeat(max + 1)).success).toBe(false)
  })
})

describe('decimalAmount', () => {
  // A length is the wrong bound for a number, so this one is a shape: 12 integer digits and 8
  // decimal places. Widening either is a currency decision, not a formatting one.
  it.each(['0', '5', '-5', '12.34', '999999999999', '999999999999.12345678'])('accepts %s', (value) => {
    expect(decimalAmount.safeParse(value).success).toBe(true)
  })

  it.each(['1234567890123', '1.123456789', '1e5', '0x10', '', ' 1', '1.', '.1', 'abc'])('rejects %s', (value) => {
    expect(decimalAmount.safeParse(value).success).toBe(false)
  })
})

describe('bounded array tiers', () => {
  const fill = <T>(count: number, item: T) => Array.from({ length: count }, () => item)

  it('caps a shopper batch at MAX_ITEMS.batch', () => {
    const item = { variantId: 'variant_1', quantity: 1 }

    expect(CreateCart.safeParse({ items: fill(MAX_ITEMS.batch, item) }).success).toBe(true)
    expect(CreateCart.safeParse({ items: fill(MAX_ITEMS.batch + 1, item) }).success).toBe(false)
  })

  it('caps a product-dimension list at MAX_ITEMS.small', () => {
    const option = { optionId: 'prodopt_1', valueIds: ['prodoptval_1'] }

    expect(AdminSetProductOptions.safeParse({ options: fill(MAX_ITEMS.small, option) }).success).toBe(true)
    expect(AdminSetProductOptions.safeParse({ options: fill(MAX_ITEMS.small + 1, option) }).success).toBe(false)
  })

  it('caps a generated variant matrix at MAX_ITEMS.bulk', () => {
    // Computed key: the option id is data, and a literal here reads as a snake_case identifier.
    const optionId = 'prodopt_1'
    const variant = { optionValues: { [optionId]: 'prodoptval_1' } }

    expect(AdminCreateProductVariantsBatch.safeParse({ variants: fill(MAX_ITEMS.bulk, variant) }).success).toBe(true)
    expect(AdminCreateProductVariantsBatch.safeParse({ variants: fill(MAX_ITEMS.bulk + 1, variant) }).success).toBe(
      false,
    )
  })
})
