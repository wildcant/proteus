import { BigNumber } from '@core/bignumber.js'
import type { IPricingModuleService } from '@core/types/pricing/service.js'
import { Modules } from '@core/utils/index.js'
import type { TestContainer } from '@tests/setup/create-container.js'
import { type Fixtures, test } from '@tests/setup/test-extend.js'
import { vi } from 'vitest'
import { updateVariantPricesWorkflow } from '../update-variant-prices.js'

type Services = Fixtures['service']

let container: TestContainer

test.beforeEach(async ({ createTestContainer }) => {
  container = await createTestContainer()
})

/** A variant priced in both markets, and a reader for what its price set actually holds. */
const dualPricedVariant = async (service: Services) => {
  const { product } = await service.create.product(container)
  const [variant] = await service.create.productVariants(container, product.id)
  if (!variant) throw new Error('Expected a variant to exist')

  const [priceSet] = await service.create.variantPrices(container, [variant.id], {
    prices: [
      { currencyCode: 'usd', amount: new BigNumber(2800) },
      { currencyCode: 'cop', amount: new BigNumber(12000000) },
    ],
  })
  if (!priceSet) throw new Error('Expected a price set to exist')

  const pricesByCurrency = async () => {
    const prices = await service.read.prices(container, priceSet.id)
    return Object.fromEntries(prices.map((price) => [price.currencyCode, { id: price.id, amount: price.amount }]))
  }

  return { variant, priceSet, pricesByCurrency }
}

/**
 * Fails the workflow's last step — the one that reads the prices back — so the upsert's own
 * compensation is what the assertion sees. Only the enrich read is broken: the step that records
 * the previous prices has already run by the time the upsert lands.
 */
const failAfterUpsert = () => {
  const pricingService = container.resolve<IPricingModuleService>(Modules.PRICING)
  const listPrices = pricingService.listPrices.bind(pricingService)
  const upsertPriceSets = pricingService.upsertPriceSets.bind(pricingService)
  let upserted = false

  vi.spyOn(pricingService, 'upsertPriceSets').mockImplementation(async (...args) => {
    const result = await upsertPriceSets(...args)
    upserted = true
    return result
  })

  vi.spyOn(pricingService, 'listPrices').mockImplementation(async (...args) => {
    if (upserted) throw new Error('pricing unavailable')
    return listPrices(...args)
  })
}

test.describe('updateVariantPricesWorkflow', () => {
  test('rollback restores the prices in every currency, not only the edited one', async ({ service, expect }) => {
    const { variant, pricesByCurrency } = await dualPricedVariant(service)
    const before = await pricesByCurrency()

    failAfterUpsert()

    await expect(
      updateVariantPricesWorkflow.run({
        variantId: variant.id,
        data: { prices: [{ id: before.usd?.id, currencyCode: 'usd', amount: new BigNumber(3500) }] },
      }),
    ).rejects.toThrow('pricing unavailable')

    vi.restoreAllMocks()
    expect(await pricesByCurrency()).toEqual(before)
  })

  test('rollback removes a currency the failed edit had added', async ({ service, expect }) => {
    const { variant, pricesByCurrency } = await dualPricedVariant(service)
    const before = await pricesByCurrency()

    failAfterUpsert()

    await expect(
      updateVariantPricesWorkflow.run({
        variantId: variant.id,
        data: { prices: [{ currencyCode: 'eur', amount: new BigNumber(2600) }] },
      }),
    ).rejects.toThrow('pricing unavailable')

    vi.restoreAllMocks()
    expect(await pricesByCurrency()).toEqual(before)
  })
})
