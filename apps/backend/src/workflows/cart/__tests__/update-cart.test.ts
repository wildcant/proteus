import { BigNumber } from '@core/bignumber.js'
import type { ICartModuleService } from '@core/types/cart/service.js'
import type { IPaymentModuleService } from '@core/types/payment/service.js'
import { Modules } from '@core/utils/index.js'
import type { TestContainer } from '@tests/setup/create-container.js'
import { type Fixtures, test } from '@tests/setup/test-extend.js'
import { vi } from 'vitest'
import { updateCartWorkflow } from '../update-cart.js'

/** The workflow takes the store's request body, not the module DTO — its address fields are
 *  required and non-null, so `generateCreateCartAddressDTO` does not fit it. */
const SHIPPING_ADDRESS = {
  firstName: 'John',
  lastName: 'Doe',
  address1: '123 Main St',
  city: 'Springfield',
  countryCode: 'US',
  postalCode: '62701',
}

let container: TestContainer

test.beforeEach(async ({ createTestContainer }) => {
  container = await createTestContainer()
})

/** The workflow's last write. Failing it is what puts the earlier steps into rollback. */
const breakTheFinalWrite = () =>
  vi
    .spyOn(container.resolve<ICartModuleService>(Modules.CART), 'updateCartWithAddresses')
    .mockRejectedValueOnce(new Error('Address update failed'))

test.describe('updateCartWorkflow', () => {
  test('creates a guest customer for a new email and links it to the cart', async ({ service, expect }) => {
    const { id: cartId } = await service.create.cart(container, { customerId: null, email: null })

    await updateCartWorkflow.run({ cartId, email: 'guest@example.com' })

    const [guest] = await service.read.customers(container, { email: 'guest@example.com' })
    expect(guest).toMatchObject({ email: 'guest@example.com', hasAccount: false })
    expect(await service.read.cart(container, cartId)).toMatchObject({
      customerId: guest?.id,
      email: 'guest@example.com',
    })
  })

  test('reuses an existing guest instead of creating a second one', async ({ service, expect }) => {
    const existing = await service.create.customer(container, {
      email: 'returning@example.com',
      hasAccount: false,
    })
    const { id: cartId } = await service.create.cart(container, { customerId: null, email: null })

    await updateCartWorkflow.run({ cartId, email: 'returning@example.com' })

    expect(await service.read.customers(container, { email: 'returning@example.com' })).toHaveLength(1)
    expect(await service.read.cart(container, cartId)).toMatchObject({ customerId: existing.id })
  })

  test('puts the supplied name on the guest it creates', async ({ service, expect }) => {
    const { id: cartId } = await service.create.cart(container, { customerId: null, email: null })

    await updateCartWorkflow.run({
      cartId,
      email: 'named@example.com',
      firstName: 'Alice',
      lastName: 'Smith',
    })

    expect(await service.read.customers(container, { email: 'named@example.com' })).toMatchObject([
      { firstName: 'Alice', lastName: 'Smith', hasAccount: false },
    ])
  })

  test('creates no customer when no email is given', async ({ service, expect }) => {
    const { id: cartId } = await service.create.cart(container, { customerId: null, email: null })

    await updateCartWorkflow.run({ cartId, shippingAddress: SHIPPING_ADDRESS })

    expect(await service.read.customers(container)).toEqual([])
    expect(await service.read.cart(container, cartId)).toMatchObject({ customerId: null })
    expect(await service.read.cartAddresses(container, { cartId })).toMatchObject([{ type: 'shipping' }])
  })

  test('rollback deletes a guest it created', async ({ service, expect }) => {
    const { id: cartId } = await service.create.cart(container, { customerId: null, email: null })
    breakTheFinalWrite()

    await expect(updateCartWorkflow.run({ cartId, email: 'guest@example.com' })).rejects.toThrow(
      'Address update failed',
    )

    expect(await service.read.customers(container, { email: 'guest@example.com' })).toEqual([])
  })

  test('rollback leaves a guest it merely found', async ({ service, expect }) => {
    const existing = await service.create.customer(container, {
      email: 'existing@example.com',
      hasAccount: false,
    })
    const { id: cartId } = await service.create.cart(container, { customerId: null, email: null })
    breakTheFinalWrite()

    await expect(updateCartWorkflow.run({ cartId, email: 'existing@example.com' })).rejects.toThrow(
      'Address update failed',
    )

    expect(await service.read.customer(container, existing.id)).toMatchObject({ id: existing.id })
  })

  test('rollback restores the name it overwrote', async ({ service, expect }) => {
    const existing = await service.create.customer(container, {
      email: 'existing@example.com',
      hasAccount: false,
      firstName: 'Old',
      lastName: 'Name',
    })
    const { id: cartId } = await service.create.cart(container, { customerId: null, email: null })
    breakTheFinalWrite()

    await expect(
      updateCartWorkflow.run({ cartId, email: 'existing@example.com', firstName: 'New', lastName: 'Name' }),
    ).rejects.toThrow('Address update failed')

    expect(await service.read.customer(container, existing.id)).toMatchObject({
      firstName: 'Old',
      lastName: 'Name',
    })
  })
})

type Factories = Fixtures['factories']
type Services = Fixtures['service']

const USD_PRICE = '80'
const COP_PRICE = '320000'
const SHIPPING_AMOUNT = '10'

/** A market: a region, the country it sells to, and one shipping option zoned to that country. */
const createMarket = async (factories: Factories, iso2: string, currencyCode: string) => {
  const region = await factories.create.region({ name: iso2.toUpperCase(), currencyCode })
  await factories.create.country({ id: iso2, regionId: region.id })
  const shippingOption = await factories.create.shippingOptionWithZone({
    geoZone: { countryCode: iso2 },
    shippingOption: { name: `${iso2.toUpperCase()} Standard` },
  })

  return { region, shippingOption }
}

/**
 * A US cart with something of everything a market switch rewrites: a line the catalogue prices in
 * both currencies, a shipping method zoned to the US alone, and a payment collection quoting the
 * total in dollars. Every one of them has to come back if any step of the switch fails.
 */
const cartReadyToSwitch = async (
  { factories, service }: Pick<Fixtures, 'factories' | 'service'>,
  options: { prices?: Array<{ amount: string; currencyCode: string }> } = {},
) => {
  const unitedStates = await createMarket(factories, 'us', 'usd')
  const colombia = await createMarket(factories, 'co', 'cop')
  const product = await factories.create.productWithPricing({
    prices: options.prices ?? [
      { amount: USD_PRICE, currencyCode: 'usd' },
      { amount: COP_PRICE, currencyCode: 'cop' },
    ],
  })

  const cart = await service.create.cart(container, { regionId: unitedStates.region.id, currencyCode: 'usd' })
  const lineItem = await service.create.lineItem(container, cart.id, {
    title: product.title,
    variantId: product.variant.id,
    quantity: 1,
    unitPrice: new BigNumber(USD_PRICE),
  })
  const shippingMethod = await service.create.shippingMethod(container, cart.id, {
    name: 'US Standard',
    amount: new BigNumber(SHIPPING_AMOUNT),
    shippingOptionId: unitedStates.shippingOption.id,
  })
  const { paymentCollection } = await service.create.paymentSessionForCart(container, {
    cartId: cart.id,
    amount: new BigNumber(Number(USD_PRICE) + Number(SHIPPING_AMOUNT)),
    currencyCode: 'usd',
  })

  return { unitedStates, colombia, product, cart, lineItem, shippingMethod, paymentCollection }
}

/** Everything the switch was supposed to move, read back as one object to assert against. */
const cartState = async (service: Services, cartId: string) => {
  const cart = await service.read.cart(container, cartId)
  const lineItems = await service.read.cartLineItems(container, { cartId })
  const shippingMethods = await service.read.cartShippingMethods(container, { cartId })
  const addresses = await service.read.cartAddresses(container, { cartId })

  return {
    regionId: cart.regionId,
    currencyCode: cart.currencyCode,
    unitPrices: lineItems.map((item) => item.unitPrice.toString()),
    shippingMethodNames: shippingMethods.map((method) => method.name),
    addressCountryCodes: addresses.map((address) => address.countryCode),
  }
}

/**
 * The market switch, unwound.
 *
 * The API seam shows what a shopper is told; these show what is left behind when a step in the
 * middle of the switch fails — the state no response body can reach, because the request that
 * would have returned it is the one that failed.
 */
test.describe('updateCartWorkflow — market switch rollback', () => {
  test('puts region, currency, prices and shipping methods back when the last step fails', async ({
    factories,
    service,
    expect,
  }) => {
    const scene = await cartReadyToSwitch({ factories, service })
    const before = await cartState(service, scene.cart.id)
    // The switch's last write. Failing it is what puts everything before it into rollback.
    vi.spyOn(
      container.resolve<IPaymentModuleService>(Modules.PAYMENT),
      'updatePaymentCollection',
    ).mockRejectedValueOnce(new Error('Payment collection unavailable'))

    await expect(updateCartWorkflow.run({ cartId: scene.cart.id, regionId: scene.colombia.region.id })).rejects.toThrow(
      'Payment collection unavailable',
    )

    expect(await cartState(service, scene.cart.id)).toEqual(before)
    expect(before).toMatchObject({
      regionId: scene.unitedStates.region.id,
      currencyCode: 'usd',
      unitPrices: [USD_PRICE],
      shippingMethodNames: ['US Standard'],
    })
  })

  test('unwinds the steps already done when one in the middle fails', async ({ factories, service, expect }) => {
    const scene = await cartReadyToSwitch({ factories, service })
    const before = await cartState(service, scene.cart.id)
    // Fails after the region and the prices have moved but before either was totalled, so the
    // rollback under test is the two writes that already landed rather than all of them.
    vi.spyOn(container.resolve<ICartModuleService>(Modules.CART), 'softDeleteShippingMethods').mockRejectedValueOnce(
      new Error('Shipping method refresh failed'),
    )

    await expect(updateCartWorkflow.run({ cartId: scene.cart.id, regionId: scene.colombia.region.id })).rejects.toThrow(
      'Shipping method refresh failed',
    )

    expect(await cartState(service, scene.cart.id)).toEqual(before)
    expect(await service.read.paymentCollection(container, scene.paymentCollection.id)).toMatchObject({
      currencyCode: 'usd',
    })
  })

  test('takes back the country the switch adopted', async ({ factories, service, expect }) => {
    const scene = await cartReadyToSwitch({ factories, service })
    vi.spyOn(
      container.resolve<IPaymentModuleService>(Modules.PAYMENT),
      'updatePaymentCollection',
    ).mockRejectedValueOnce(new Error('Payment collection unavailable'))

    await expect(updateCartWorkflow.run({ cartId: scene.cart.id, regionId: scene.colombia.region.id })).rejects.toThrow(
      'Payment collection unavailable',
    )

    // The switch wrote `co` onto a cart that had no address at all, so rollback owes the shopper
    // a cart with no address rather than one shipping to a country they never chose.
    expect(await service.read.cartAddresses(container, { cartId: scene.cart.id })).toEqual([])
  })

  test('moves nothing when a line has no price in the new market', async ({ factories, service, expect }) => {
    const scene = await cartReadyToSwitch(
      { factories, service },
      { prices: [{ amount: USD_PRICE, currencyCode: 'usd' }] },
    )
    const before = await cartState(service, scene.cart.id)

    await expect(updateCartWorkflow.run({ cartId: scene.cart.id, regionId: scene.colombia.region.id })).rejects.toThrow(
      scene.product.title,
    )

    expect(await cartState(service, scene.cart.id)).toEqual(before)
    expect(await service.read.paymentCollection(container, scene.paymentCollection.id)).toMatchObject({
      currencyCode: 'usd',
    })
  })
})
