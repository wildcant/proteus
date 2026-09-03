import { BigNumber } from '@core/bignumber.js'
import { ErrorTypes } from '@core/errors/app-error.js'
import type { TestContainer } from '@tests/setup/create-container.js'
import type { Fixtures } from '@tests/setup/test-extend.js'
import { test } from '@tests/setup/test-extend.js'
import { addToCartWorkflow } from '../add-to-cart.js'

type Services = Fixtures['service']

let container: TestContainer

test.beforeEach(async ({ createTestContainer }) => {
  container = await createTestContainer()
})

/** Every price the catalogue quotes here is in dollars, so the cart has to be too. */
const usdCart = (service: Services) => service.create.cart(container, { currencyCode: 'usd' })

test.describe('addToCartWorkflow', () => {
  test('writes the line item from the catalogue rather than from the request', async ({ service, expect }) => {
    const cart = await usdCart(service)
    const { variant } = await service.create.sellableVariant(container, {
      product: { title: 'Field Jacket', handle: 'field-jacket', subtitle: 'Waxed cotton' },
      variant: { sku: 'FJ-OLV-M' },
      price: { amount: new BigNumber('149.5'), currencyCode: 'usd' },
      inventory: { level: { stockedQuantity: 10 } },
    })

    await addToCartWorkflow.run({ cartId: cart.id, items: [{ variantId: variant.id, quantity: 2 }] })

    const [lineItem] = await service.read.cartLineItems(container, { cartId: cart.id })
    expect(lineItem).toMatchObject({
      // The product names the line and the variant qualifies it, which is how the cart panel
      // stacks them.
      title: 'Field Jacket',
      productHandle: 'field-jacket',
      productSubtitle: 'Waxed cotton',
      variantSku: 'FJ-OLV-M',
      variantId: variant.id,
      quantity: 2,
    })
    // The one field a caller used to be able to name for itself.
    expect(lineItem?.unitPrice.toString()).toBe('149.5')
  })

  test('names the variant’s option values on the line', async ({ service, expect }) => {
    const cart = await usdCart(service)
    const { product } = await service.create.product(container, { status: 'published' })
    const size = await service.create.productOption(container, {
      title: `Size-${product.id}`,
      renderAs: 'text',
      values: [{ value: 'M', rank: 0 }],
    })
    const colour = await service.create.productOption(container, {
      title: `Colour-${product.id}`,
      renderAs: 'swatch',
      values: [{ value: 'Olive', rank: 0 }],
    })
    await service.update.productOptions(container, product.id, {
      options: [
        { optionId: size.id, valueIds: size.values.map((value) => value.id) },
        { optionId: colour.id, valueIds: colour.values.map((value) => value.id) },
      ],
    })
    const [sizeValue, colourValue] = [size.values[0], colour.values[0]]
    if (!sizeValue || !colourValue) throw new Error('Expected each option to carry one value')

    const variant = await service.create.productVariant(container, product.id, {
      optionValues: { [size.id]: sizeValue.id, [colour.id]: colourValue.id },
    })
    await service.create.variantPrices(container, [variant.id])

    await addToCartWorkflow.run({ cartId: cart.id, items: [{ variantId: variant.id, quantity: 1 }] })

    const [lineItem] = await service.read.cartLineItems(container, { cartId: cart.id })
    // In the product's own option order, values only — the string the cart panel prints verbatim.
    expect(lineItem?.variantOptionValues).toBe('M · Olive')
    // And the variant's own name beside it, which the module derives from the same combination.
    expect(lineItem?.variantTitle).toBe('M / Olive')
  })

  test('raises the line the cart already holds instead of adding a second', async ({ service, expect }) => {
    const cart = await usdCart(service)
    const { variant } = await service.create.sellableVariant(container, {
      inventory: { level: { stockedQuantity: 10 } },
    })

    await addToCartWorkflow.run({ cartId: cart.id, items: [{ variantId: variant.id, quantity: 2 }] })
    await addToCartWorkflow.run({ cartId: cart.id, items: [{ variantId: variant.id, quantity: 3 }] })

    const lineItems = await service.read.cartLineItems(container, { cartId: cart.id })
    expect(lineItems).toHaveLength(1)
    expect(lineItems[0]).toMatchObject({ variantId: variant.id, quantity: 5 })
  })

  test('folds repeats of one variant inside a single call', async ({ service, expect }) => {
    const cart = await usdCart(service)
    const { variant } = await service.create.sellableVariant(container, {
      inventory: { level: { stockedQuantity: 10 } },
    })

    await addToCartWorkflow.run({
      cartId: cart.id,
      items: [
        { variantId: variant.id, quantity: 1 },
        { variantId: variant.id, quantity: 2 },
      ],
    })

    const lineItems = await service.read.cartLineItems(container, { cartId: cart.id })
    expect(lineItems).toHaveLength(1)
    expect(lineItems[0]).toMatchObject({ quantity: 3 })
  })

  test('refuses an addition the merged line has no stock for', async ({ service, expect }) => {
    const cart = await usdCart(service)
    const { variant } = await service.create.sellableVariant(container, {
      inventory: { level: { stockedQuantity: 3 } },
    })
    await addToCartWorkflow.run({ cartId: cart.id, items: [{ variantId: variant.id, quantity: 2 }] })

    // Two more clears the three in stock only if the two already in the bag are ignored — the
    // whole reason coverage is checked against the post-merge quantity.
    await expect(
      addToCartWorkflow.run({ cartId: cart.id, items: [{ variantId: variant.id, quantity: 2 }] }),
    ).rejects.toMatchObject({ cause: { type: ErrorTypes.CONFLICT } })

    const lineItems = await service.read.cartLineItems(container, { cartId: cart.id })
    expect(lineItems).toHaveLength(1)
    expect(lineItems[0]).toMatchObject({ quantity: 2 })
  })

  test('adds a variant nothing stocks', async ({ service, expect }) => {
    const cart = await usdCart(service)
    const { variant } = await service.create.sellableVariant(container, { inventory: null })

    await addToCartWorkflow.run({ cartId: cart.id, items: [{ variantId: variant.id, quantity: 4 }] })

    // No inventory item behind it means it is not stock-managed, which the storefront already
    // treats as buyable — refusing it here would take every unmanaged product off sale.
    expect(await service.read.cartLineItems(container, { cartId: cart.id })).toHaveLength(1)
  })

  test('refuses a variant the catalogue cannot price in the cart’s currency', async ({ service, expect }) => {
    const cart = await service.create.cart(container, { currencyCode: 'eur' })
    const { variant } = await service.create.sellableVariant(container, {
      price: { currencyCode: 'usd' },
      inventory: { level: { stockedQuantity: 10 } },
    })

    await expect(
      addToCartWorkflow.run({ cartId: cart.id, items: [{ variantId: variant.id, quantity: 1 }] }),
    ).rejects.toMatchObject({ cause: { type: ErrorTypes.INVALID_DATA } })

    expect(await service.read.cartLineItems(container, { cartId: cart.id })).toEqual([])
  })

  test('refuses a product that is not published', async ({ service, expect }) => {
    const cart = await usdCart(service)
    const { variant } = await service.create.sellableVariant(container, {
      product: { status: 'draft' },
      inventory: { level: { stockedQuantity: 10 } },
    })

    await expect(
      addToCartWorkflow.run({ cartId: cart.id, items: [{ variantId: variant.id, quantity: 1 }] }),
    ).rejects.toMatchObject({ cause: { type: ErrorTypes.NOT_ALLOWED } })
  })

  test('refuses a variant that does not exist', async ({ service, expect }) => {
    const cart = await usdCart(service)

    await expect(
      addToCartWorkflow.run({ cartId: cart.id, items: [{ variantId: 'variant_missing', quantity: 1 }] }),
    ).rejects.toMatchObject({ cause: { type: ErrorTypes.NOT_FOUND } })
  })

  test('refuses a cart that has already been completed', async ({ service, expect }) => {
    const cart = await usdCart(service)
    const { variant } = await service.create.sellableVariant(container, {
      inventory: { level: { stockedQuantity: 10 } },
    })
    await service.update.cart(container, cart.id, { completedAt: new Date(), customerId: cart.customerId })

    await expect(
      addToCartWorkflow.run({ cartId: cart.id, items: [{ variantId: variant.id, quantity: 1 }] }),
    ).rejects.toMatchObject({ cause: { type: ErrorTypes.NOT_ALLOWED } })

    expect(await service.read.cartLineItems(container, { cartId: cart.id })).toEqual([])
  })
})
