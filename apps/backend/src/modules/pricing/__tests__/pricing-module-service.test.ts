import { test } from '@tests/setup/test-extend.js'
import { describe } from 'vitest'
import { BigNumber } from '../../../core/db/bignum.js'
import { createWithTransaction } from '../../../core/utils/with-transaction.js'
import { PriceRepository } from '../repositories/price.js'
import { PriceSetRepository } from '../repositories/price-set.js'
import { PricingModuleService } from '../services/pricing-module-service.js'

let service: PricingModuleService

test.beforeEach(({ getDb, logger }) => {
  const priceSetRepository = new PriceSetRepository({ getDb })
  const priceRepository = new PriceRepository({ getDb })
  const withTransaction = createWithTransaction(getDb)
  service = new PricingModuleService({
    priceSetRepository,
    priceRepository,
    withTransaction,
    logger,
  })
})

describe('PricingModuleService', () => {
  test('createPriceSets creates price set with inline prices', async ({ expect, dto }) => {
    const [priceSet] = await service.createPriceSets([dto.generate.createPriceSet()])

    expect(priceSet?.id).toMatch(/^pset_/)
    expect(priceSet?.createdAt).toBeInstanceOf(Date)

    const prices = await service.listPrices({ priceSetId: priceSet?.id })
    expect(prices).toHaveLength(1)
    expect(prices[0]?.currencyCode).toBe('usd')
    expect(prices[0]?.amount).toBeInstanceOf(BigNumber)
  })

  test('createPriceSets creates empty price set when no prices provided', async ({ expect }) => {
    const [priceSet] = await service.createPriceSets([{}])

    expect(priceSet?.id).toMatch(/^pset_/)
    const prices = await service.listPrices({ priceSetId: priceSet?.id })
    expect(prices).toHaveLength(0)
  })

  test('listPrices with filters', async ({ expect }) => {
    const [priceSet] = await service.createPriceSets([
      {
        prices: [
          { currencyCode: 'usd', amount: new BigNumber('10.00') },
          { currencyCode: 'eur', amount: new BigNumber('9.00') },
        ],
      },
    ])

    const usdPrices = await service.listPrices({
      priceSetId: priceSet?.id,
      currencyCode: 'usd',
    })

    expect(usdPrices).toHaveLength(1)
    expect(usdPrices[0]?.currencyCode).toBe('usd')
  })

  test('deletePriceSets cascades to prices', async ({ expect, dto }) => {
    const [priceSet] = await service.createPriceSets([dto.generate.createPriceSet()])
    const priceSetId = priceSet?.id ?? ''

    await service.deletePriceSets([priceSetId])

    const prices = await service.listPrices({ priceSetId })
    expect(prices).toHaveLength(0)
  })

  test('addPrices adds prices to existing price set', async ({ expect }) => {
    const [priceSet] = await service.createPriceSets([{}])
    const priceSetId = priceSet?.id ?? ''

    const added = await service.addPrices(priceSetId, [{ currencyCode: 'usd', amount: new BigNumber('25.00') }])

    expect(added).toHaveLength(1)
    expect(added[0]?.id).toMatch(/^price_/)
    expect(added[0]?.priceSetId).toBe(priceSetId)
  })

  test('updatePrices updates amount', async ({ expect }) => {
    const [priceSet] = await service.createPriceSets([
      { prices: [{ currencyCode: 'usd', amount: new BigNumber('10.00') }] },
    ])
    const prices = await service.listPrices({ priceSetId: priceSet?.id })
    const priceId = prices[0]?.id ?? ''

    const [updated] = await service.updatePrices([priceId], { amount: new BigNumber('20.00') })

    expect(updated?.amount.toFixed()).toBe('20')
  })

  test('removePrices soft-deletes prices', async ({ expect }) => {
    const [priceSet] = await service.createPriceSets([
      { prices: [{ currencyCode: 'usd', amount: new BigNumber('10.00') }] },
    ])
    const prices = await service.listPrices({ priceSetId: priceSet?.id })
    const priceId = prices[0]?.id ?? ''

    await service.removePrices([priceId])

    const remaining = await service.listPrices({ priceSetId: priceSet?.id })
    expect(remaining).toHaveLength(0)
  })

  test('createPriceSet creates a single price set with inline prices', async ({ expect, dto }) => {
    const priceSet = await service.createPriceSet(dto.generate.createPriceSet())

    expect(priceSet.id).toMatch(/^pset_/)

    const prices = await service.listPrices({ priceSetId: priceSet.id })
    expect(prices).toHaveLength(1)
  })

  test('addPrice adds a single price to existing price set', async ({ expect }) => {
    const priceSet = await service.createPriceSet({})

    const price = await service.addPrice(priceSet.id, { currencyCode: 'usd', amount: new BigNumber('15.00') })

    expect(price.id).toMatch(/^price_/)
    expect(price.priceSetId).toBe(priceSet.id)
    expect(price.amount.toFixed()).toBe('15')
  })

  test('updatePrice updates a single price', async ({ expect }) => {
    const priceSet = await service.createPriceSet({
      prices: [{ currencyCode: 'usd', amount: new BigNumber('10.00') }],
    })
    const prices = await service.listPrices({ priceSetId: priceSet.id })
    const priceId = prices[0]?.id ?? ''

    const updated = await service.updatePrice(priceId, { amount: new BigNumber('30.00') })

    expect(updated.amount.toFixed()).toBe('30')
    expect(updated.id).toBe(priceId)
  })

  test('calculatePrices returns calculated price for single price set', async ({ expect }) => {
    const priceSet = await service.createPriceSet({
      prices: [{ currencyCode: 'usd', amount: new BigNumber('49.99') }],
    })

    const results = await service.calculatePrices([priceSet.id], { currencyCode: 'usd' })

    expect(results).toHaveLength(1)
    expect(results[0]?.id).toBe(priceSet.id)
    expect(results[0]?.calculatedAmount?.toFixed()).toBe('49.99')
    expect(results[0]?.currencyCode).toBe('usd')
  })

  test('calculatePrices returns calculated prices for multiple price sets', async ({ expect }) => {
    const priceSetA = await service.createPriceSet({
      prices: [{ currencyCode: 'usd', amount: new BigNumber('10.00') }],
    })
    const priceSetB = await service.createPriceSet({
      prices: [{ currencyCode: 'usd', amount: new BigNumber('20.00') }],
    })

    const results = await service.calculatePrices([priceSetA.id, priceSetB.id], { currencyCode: 'usd' })

    expect(results).toHaveLength(2)
    const amounts = results.map((r) => r.calculatedAmount?.toFixed()).sort()
    expect(amounts).toEqual(['10', '20'])
  })

  test('calculatePrices returns no entry for missing price set', async ({ expect }) => {
    const priceSet = await service.createPriceSet({
      prices: [{ currencyCode: 'usd', amount: new BigNumber('10.00') }],
    })

    const results = await service.calculatePrices([priceSet.id, 'pset_nonexistent'], { currencyCode: 'usd' })

    expect(results).toHaveLength(1)
    expect(results[0]?.id).toBe(priceSet.id)
  })

  test('calculatePrices filters by currency code', async ({ expect }) => {
    const priceSet = await service.createPriceSet({
      prices: [
        { currencyCode: 'usd', amount: new BigNumber('10.00') },
        { currencyCode: 'eur', amount: new BigNumber('9.00') },
      ],
    })

    const usdResults = await service.calculatePrices([priceSet.id], { currencyCode: 'usd' })
    expect(usdResults).toHaveLength(1)
    expect(usdResults[0]?.calculatedAmount?.toFixed()).toBe('10')
    expect(usdResults[0]?.currencyCode).toBe('usd')

    const eurResults = await service.calculatePrices([priceSet.id], { currencyCode: 'eur' })
    expect(eurResults).toHaveLength(1)
    expect(eurResults[0]?.calculatedAmount?.toFixed()).toBe('9')
    expect(eurResults[0]?.currencyCode).toBe('eur')
  })

  test('calculatePrices returns empty array for empty input', async ({ expect }) => {
    const results = await service.calculatePrices([], { currencyCode: 'usd' })
    expect(results).toHaveLength(0)
  })

  test('duplicate prices in same currency are deduplicated (last wins)', async ({ expect }) => {
    const priceSet = await service.createPriceSet({
      prices: [
        { currencyCode: 'usd', amount: new BigNumber('10.00') },
        { currencyCode: 'usd', amount: new BigNumber('20.00') },
      ],
    })

    const prices = await service.listPrices({ priceSetId: priceSet.id })
    expect(prices).toHaveLength(1)
    expect(prices[0]?.amount.toFixed()).toBe('20')
  })

  test('addPrices deduplicates by currency', async ({ expect }) => {
    const priceSet = await service.createPriceSet({})

    const added = await service.addPrices(priceSet.id, [
      { currencyCode: 'eur', amount: new BigNumber('5.00') },
      { currencyCode: 'eur', amount: new BigNumber('8.00') },
    ])

    expect(added).toHaveLength(1)
    expect(added[0]?.amount.toFixed()).toBe('8')
  })

  test('BigNumber amounts round-trip without precision loss', async ({ expect }) => {
    const preciseAmount = '1234567890.123456789'
    const [priceSet] = await service.createPriceSets([
      { prices: [{ currencyCode: 'usd', amount: new BigNumber(preciseAmount) }] },
    ])

    const prices = await service.listPrices({ priceSetId: priceSet?.id })

    expect(prices[0]?.amount.toFixed()).toBe(preciseAmount)
  })
})
