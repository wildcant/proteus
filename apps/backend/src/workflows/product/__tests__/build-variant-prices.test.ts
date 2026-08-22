import { test } from '@tests/setup/test-extend.js'
import { BigNumber } from '../../../core/db/bignum.js'
import { buildVariantPrices } from '../utils/build-variant-prices.js'

test.describe('buildVariantPrices', () => {
  test('maps each variant to its calculated price', ({ dto, expect }) => {
    const links = [
      dto.generate.productVariantPriceSet({ variantId: 'var_1', priceSetId: 'ps_1' }),
      dto.generate.productVariantPriceSet({ variantId: 'var_2', priceSetId: 'ps_2' }),
    ]
    const prices = [
      dto.generate.calculatedPriceSet({ id: 'ps_1', calculatedAmount: new BigNumber(20) }),
      dto.generate.calculatedPriceSet({ id: 'ps_2', calculatedAmount: new BigNumber(35) }),
    ]

    const result = buildVariantPrices(links, prices)

    expect(result.size).toBe(2)
    expect(result.get('var_1')?.calculatedAmount.toNumber()).toBe(20)
    expect(result.get('var_2')?.calculatedAmount.toNumber()).toBe(35)
  })

  test('preserves currency code from the calculated price', ({ dto, expect }) => {
    const links = [dto.generate.productVariantPriceSet({ variantId: 'var_1', priceSetId: 'ps_1' })]
    const prices = [
      dto.generate.calculatedPriceSet({ id: 'ps_1', calculatedAmount: new BigNumber(10), currencyCode: 'eur' }),
    ]

    const result = buildVariantPrices(links, prices)

    expect(result.get('var_1')?.currencyCode).toBe('eur')
  })

  test('skips variants without a matching calculated price', ({ dto, expect }) => {
    const links = [dto.generate.productVariantPriceSet({ variantId: 'var_1', priceSetId: 'ps_1' })]
    const prices = [dto.generate.calculatedPriceSet({ id: 'ps_other' })]

    const result = buildVariantPrices(links, prices)

    expect(result.size).toBe(0)
  })

  test('returns empty map for empty inputs', ({ expect }) => {
    const result = buildVariantPrices([], [])

    expect(result.size).toBe(0)
  })
})
