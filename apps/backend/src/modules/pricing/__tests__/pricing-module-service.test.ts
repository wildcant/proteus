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

  test('BigNumber amounts round-trip without precision loss', async ({ expect }) => {
    const preciseAmount = '1234567890.123456789'
    const [priceSet] = await service.createPriceSets([
      { prices: [{ currencyCode: 'usd', amount: new BigNumber(preciseAmount) }] },
    ])

    const prices = await service.listPrices({ priceSetId: priceSet?.id })

    expect(prices[0]?.amount.toFixed()).toBe(preciseAmount)
  })
})
