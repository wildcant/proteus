import { test } from '@tests/setup/test-extend.js'
import { BigNumber } from '../../../core/bignumber.js'
import { buildStartingPrices } from '../utils/build-starting-prices.js'

test.describe('buildStartingPrices', () => {
  test('picks the cheapest variant price per product', ({ dto, expect }) => {
    const variants = [
      { id: 'var_1', productId: 'prod_1' },
      { id: 'var_2', productId: 'prod_1' },
    ]
    const links = [
      dto.generate.productVariantPriceSet({ variantId: 'var_1', priceSetId: 'ps_1' }),
      dto.generate.productVariantPriceSet({ variantId: 'var_2', priceSetId: 'ps_2' }),
    ]
    const prices = [
      dto.generate.calculatedPriceSet({ id: 'ps_1', calculatedAmount: new BigNumber(30) }),
      dto.generate.calculatedPriceSet({ id: 'ps_2', calculatedAmount: new BigNumber(10) }),
    ]

    const result = buildStartingPrices(variants, links, prices)

    expect(result.size).toBe(1)
    const starting = result.get('prod_1')
    expect(starting?.calculatedAmount.toNumber()).toBe(10)
    expect(starting?.id).toBe('ps_2')
  })

  test('returns separate starting prices for different products', ({ dto, expect }) => {
    const variants = [
      { id: 'var_1', productId: 'prod_1' },
      { id: 'var_2', productId: 'prod_2' },
    ]
    const links = [
      dto.generate.productVariantPriceSet({ variantId: 'var_1', priceSetId: 'ps_1' }),
      dto.generate.productVariantPriceSet({ variantId: 'var_2', priceSetId: 'ps_2' }),
    ]
    const prices = [
      dto.generate.calculatedPriceSet({ id: 'ps_1', calculatedAmount: new BigNumber(20) }),
      dto.generate.calculatedPriceSet({ id: 'ps_2', calculatedAmount: new BigNumber(50) }),
    ]

    const result = buildStartingPrices(variants, links, prices)

    expect(result.size).toBe(2)
    expect(result.get('prod_1')?.calculatedAmount.toNumber()).toBe(20)
    expect(result.get('prod_2')?.calculatedAmount.toNumber()).toBe(50)
  })

  test('skips variants without a link', ({ dto, expect }) => {
    const variants = [{ id: 'var_1', productId: 'prod_1' }]
    const prices = [dto.generate.calculatedPriceSet({ id: 'ps_1', calculatedAmount: new BigNumber(10) })]

    const result = buildStartingPrices(variants, [], prices)

    expect(result.size).toBe(0)
  })

  test('returns empty map for empty inputs', ({ expect }) => {
    const result = buildStartingPrices([], [], [])

    expect(result.size).toBe(0)
  })
})
