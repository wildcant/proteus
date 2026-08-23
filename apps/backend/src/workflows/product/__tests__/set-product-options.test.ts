import { BigNumber } from '@core/db/bignum.js'
import type { IProductModuleService } from '@core/types/product/service.js'
import { Modules } from '@core/utils/index.js'
import type { TestContainer } from '@tests/setup/create-container.js'
import { type Fixtures, test } from '@tests/setup/test-extend.js'
import { assertDefined } from '@tests/utils/assert-defined.js'
import { vi } from 'vitest'
import { setProductOptionsWorkflow } from '../set-product-options.js'

type Services = Fixtures['service']

let container: TestContainer

test.beforeEach(async ({ createTestContainer }) => {
  container = await createTestContainer()
})

const valueId = (option: { values: { id: string; value: string }[] }, value: string) => {
  const match = option.values.find((candidate) => candidate.value === value)
  if (!match) throw new Error(`Expected the option to carry the value "${value}"`)
  return match.id
}

/** A product offering Size S/M, with a variant for each — the state an edit has to bring along. */
const productSizedSAndM = async (service: Services) => {
  const { product } = await service.create.product(container)
  const size = await service.create.productOption(container, {
    title: `Size-${product.id}`,
    values: [{ value: 'S' }, { value: 'M' }],
  })
  const colour = await service.create.productOption(container, {
    title: `Colour-${product.id}`,
    values: [{ value: 'Red' }, { value: 'Blue' }],
  })

  await service.update.productOptions(container, product.id, {
    options: [{ optionId: size.id, valueIds: size.values.map((value) => value.id) }],
  })
  const variants = await service.create.productVariants(container, product.id, [
    { optionValues: { [size.id]: valueId(size, 'S') } },
    { optionValues: { [size.id]: valueId(size, 'M') } },
  ])

  const titles = async () =>
    (await service.read.productVariants(container, { productId: product.id })).map((variant) => variant.title).sort()

  /** Both options at full spread: four combinations against the two variants that exist. */
  const expanded = {
    options: [
      { optionId: size.id, valueIds: size.values.map((value) => value.id) },
      { optionId: colour.id, valueIds: colour.values.map((value) => value.id) },
    ],
  }

  return { product, size, colour, variants, titles, expanded }
}

test.describe('setProductOptionsWorkflow', () => {
  test('creates the combinations the new options open up', async ({ service, expect }) => {
    const { product, titles, expanded } = await productSizedSAndM(service)

    await setProductOptionsWorkflow.run({ productId: product.id, data: expanded })

    // The two that existed are reassigned; the other two are new.
    expect(await titles()).toEqual(['M / Blue', 'M / Red', 'S / Blue', 'S / Red'])
  })

  test('prices a created variant from the survivor it came closest to', async ({ service, expect }) => {
    const { product, variants, expanded } = await productSizedSAndM(service)
    const [small] = variants
    assertDefined(small)
    await service.create.variantPrices(container, [small.id], {
      prices: [{ currencyCode: 'usd', amount: new BigNumber(2800) }],
    })

    await setProductOptionsWorkflow.run({ productId: product.id, data: expanded })

    // `S / Blue` did not exist before, and shares its size value with the priced `S`.
    const created = (await service.read.productVariants(container, { productId: product.id })).find(
      (variant) => variant.title === 'S / Blue',
    )
    assertDefined(created)
    const [link] = await service.read.linkRepo(container, 'productVariantPriceSet').findByVariantIds([created.id])
    assertDefined(link)
    const prices = await service.read.prices(container, link.priceSetId)
    expect(prices.map((price) => ({ currencyCode: price.currencyCode, amount: Number(price.amount) }))).toEqual([
      { currencyCode: 'usd', amount: 2800 },
    ])
  })

  test('a dropped variant takes its price set with it', async ({ service, expect }) => {
    const { product, size, variants, titles } = await productSizedSAndM(service)
    const [, medium] = variants
    assertDefined(medium)
    const [priceSet] = await service.create.variantPrices(container, [medium.id])
    assertDefined(priceSet)

    await setProductOptionsWorkflow.run({
      productId: product.id,
      data: { options: [{ optionId: size.id, valueIds: [valueId(size, 'S')] }] },
    })

    expect(await titles()).toEqual(['S'])
    expect(await service.read.linkRepo(container, 'productVariantPriceSet').findByVariantIds([medium.id])).toEqual([])
    expect(await service.read.prices(container, priceSet.id)).toEqual([])
  })

  test('a dropped variant is evicted from active carts but not from completed ones', async ({ service, expect }) => {
    const { product, size, variants } = await productSizedSAndM(service)
    const [, medium] = variants
    assertDefined(medium)

    const active = await service.create.cart(container)
    const completed = await service.create.cart(container)
    await service.create.lineItem(container, active.id, { variantId: medium.id })
    await service.create.lineItem(container, completed.id, { variantId: medium.id })
    await service.update.cart(container, completed.id, { status: 'completed', completedAt: new Date() })

    await setProductOptionsWorkflow.run({
      productId: product.id,
      data: { options: [{ optionId: size.id, valueIds: [valueId(size, 'S')] }] },
    })

    // A completed cart is the record behind an order; rewriting it would rewrite history.
    expect(await service.read.cartLineItems(container, { cartId: active.id })).toEqual([])
    expect(await service.read.cartLineItems(container, { cartId: completed.id })).toHaveLength(1)
  })

  test('a change that removes nothing leaves the carts alone', async ({ service, expect }) => {
    const { product, variants, expanded } = await productSizedSAndM(service)
    const [small] = variants
    assertDefined(small)
    const cart = await service.create.cart(container)
    await service.create.lineItem(container, cart.id, { variantId: small.id })

    await setProductOptionsWorkflow.run({ productId: product.id, data: expanded })

    expect(await service.read.cartLineItems(container, { cartId: cart.id })).toHaveLength(1)
  })

  test('rollback puts the previous options and combinations back', async ({ service, expect }) => {
    const { product, size, titles, expanded } = await productSizedSAndM(service)

    vi.spyOn(container.resolve<IProductModuleService>(Modules.PRODUCT), 'createProductVariants').mockRejectedValueOnce(
      new Error('SKU collision'),
    )

    await expect(setProductOptionsWorkflow.run({ productId: product.id, data: expanded })).rejects.toThrow(
      'SKU collision',
    )

    expect(await titles()).toEqual(['M', 'S'])
    expect(await service.read.productOptionsForProduct(container, product.id)).toMatchObject([{ id: size.id }])
  })
})
