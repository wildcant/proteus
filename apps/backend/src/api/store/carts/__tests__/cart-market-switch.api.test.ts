import { BigNumber } from '@core/bignumber.js'
import type {
  StoreCartDetailResponse,
  StoreCreatePaymentCollectionResponse,
  StoreUpdateCartResponse,
} from '@proteus/http-schemas/store'
import type { ApiErrorBody, TestApi } from '@tests/setup/create-api.js'
import { type Fixtures, test } from '@tests/setup/test-extend.js'
import paymentCollectionDefinitions from '../../payment-collections/definitions.js'
import cartDefinitions from '../definitions.js'

type Factories = Fixtures['factories']
type Services = Fixtures['service']

/**
 * One variant priced in both markets, so every assertion below reads a number that could have been
 * the other one. `320000` is not `80` converted — a shop prices each market on its own — which is
 * exactly why the cart has to be repriced from the catalogue rather than multiplied by a rate.
 */
const USD_PRICE = '80'
const COP_PRICE = '320000'

let api: TestApi

test.beforeEach(async ({ createApi }) => {
  api = await createApi({ definitions: [...cartDefinitions, ...paymentCollectionDefinitions] })
})

/** A market: a region, the country it sells to, and one shipping option zoned to that country. */
const createMarket = async (factories: Factories, iso2: string, currencyCode: string) => {
  const region = await factories.create.region({ name: iso2.toUpperCase(), currencyCode })
  const country = await factories.create.country({ id: iso2, regionId: region.id })
  const shippingOption = await factories.create.shippingOptionWithZone({
    geoZone: { countryCode: iso2 },
    shippingOption: { name: `${iso2.toUpperCase()} Standard` },
  })

  return { region, country, shippingOption }
}

/** Both markets, so a switch always has somewhere real to go and somewhere real to come from. */
const createMarkets = async (factories: Factories) => ({
  unitedStates: await createMarket(factories, 'us', 'usd'),
  colombia: await createMarket(factories, 'co', 'cop'),
})

type Market = Awaited<ReturnType<typeof createMarket>>

/** A cart in a market, holding one line of a variant the catalogue prices in both currencies. */
const cartInMarket = async (
  { factories, service }: Pick<Fixtures, 'factories' | 'service'>,
  market: Market,
  options: { prices?: Array<{ amount: string; currencyCode: string }> } = {},
) => {
  const product = await factories.create.productWithPricing({
    prices: options.prices ?? [
      { amount: USD_PRICE, currencyCode: 'usd' },
      { amount: COP_PRICE, currencyCode: 'cop' },
    ],
  })
  const cart = await service.create.cart(api.container, {
    regionId: market.region.id,
    currencyCode: market.region.currencyCode,
  })
  const lineItem = await service.create.lineItem(api.container, cart.id, {
    title: product.title,
    variantId: product.variant.id,
    quantity: 2,
    unitPrice: new BigNumber(product.prices[0]?.amount ?? USD_PRICE),
  })

  return { cart, product, lineItem }
}

const switchMarket = (cartId: string, market: Market) =>
  api.post<StoreUpdateCartResponse>(`/store/carts/${cartId}`, { regionId: market.region.id })

/** The same switch, named the way a storefront names it: the country segment in its own URL. */
const switchToCountry = (cartId: string, countryCode: string) =>
  api.post<StoreUpdateCartResponse>(`/store/carts/${cartId}`, { countryCode })

const readCart = (cartId: string) => api.get<StoreCartDetailResponse>(`/store/carts/${cartId}`)

const shipTo = (service: Services, cartId: string, countryCode: string) =>
  service.create.cartAddresses(api.container, cartId, {
    shippingAddress: { countryCode, city: 'Anywhere', province: 'Anywhere', postalCode: '00000' },
    billingAddress: undefined,
  })

/** The collection the cart already has, or the one checkout would have opened for it. */
const paymentCollectionFor = (cartId: string) =>
  api.post<StoreCreatePaymentCollectionResponse>('/store/payment-collections', { cartId })

/**
 * Switching market keeps the cart and reprices it. Everything with a number on it moves together —
 * the line items, the shipping the cart quotes, and the amount a shopper will be asked to
 * authorise — because a basket holding two currencies at once bills one of them.
 */
test.describe('POST /store/carts/:id — market switch', () => {
  test('reprices every line into the new market’s currency', async ({ factories, service, expect }) => {
    const markets = await createMarkets(factories)
    const { cart } = await cartInMarket({ factories, service }, markets.unitedStates)

    const { status, body } = await switchMarket(cart.id, markets.colombia)

    expect(status).toBe(200)
    expect(body.cart).toMatchObject({ regionId: markets.colombia.region.id, currencyCode: 'cop' })

    const detail = await readCart(cart.id)
    expect(detail.body.cart.currencyCode).toBe('cop')
    expect(detail.body.cart.items.map((item) => item.unitPrice)).toEqual([COP_PRICE])
    expect(detail.body.cart.totals.cartTotal).toBe('640000')
  })

  test('reprices back into the market it came from', async ({ factories, service, expect }) => {
    const markets = await createMarkets(factories)
    const { cart } = await cartInMarket({ factories, service }, markets.unitedStates)

    await switchMarket(cart.id, markets.colombia)
    const { status } = await switchMarket(cart.id, markets.unitedStates)

    expect(status).toBe(200)
    const detail = await readCart(cart.id)
    // The basket never holds one line quoted in cop next to another quoted in usd: the currency
    // on the cart and the price on every line are written by the same step.
    expect(detail.body.cart.currencyCode).toBe('usd')
    expect(detail.body.cart.items.map((item) => item.unitPrice)).toEqual([USD_PRICE])
  })

  test('drops a shipping method the new market does not offer', async ({ factories, service, expect }) => {
    const markets = await createMarkets(factories)
    const { cart } = await cartInMarket({ factories, service }, markets.unitedStates)
    await service.create.shippingMethod(api.container, cart.id, {
      name: 'US Standard',
      shippingOptionId: markets.unitedStates.shippingOption.id,
    })
    await service.create.shippingMethod(api.container, cart.id, {
      name: 'CO Standard',
      shippingOptionId: markets.colombia.shippingOption.id,
    })

    await switchMarket(cart.id, markets.colombia)

    // Only the option the new market's country is actually zoned for survives — the US rate is a
    // delivery nobody in Colombia is offering, not a cheaper one.
    const detail = await readCart(cart.id)
    expect(detail.body.cart.shippingMethods.map((method) => method.name)).toEqual(['CO Standard'])
  })

  test('restates the amount to authorise in the money the cart now quotes', async ({ factories, service, expect }) => {
    const markets = await createMarkets(factories)
    const { cart } = await cartInMarket({ factories, service }, markets.unitedStates)
    const opened = await paymentCollectionFor(cart.id)
    expect(opened.body.paymentCollection).toMatchObject({ amount: '160', currencyCode: 'usd' })

    await switchMarket(cart.id, markets.colombia)

    // Same collection, restated: a shopper authorises the total they were just quoted, in the
    // currency they were quoted it in.
    const { body } = await paymentCollectionFor(cart.id)
    expect(body.paymentCollection).toMatchObject({
      id: opened.body.paymentCollection.id,
      amount: '640000',
      currencyCode: 'cop',
    })
  })

  test('refuses a switch to a market that does not ship to the cart’s address', async ({
    factories,
    service,
    expect,
  }) => {
    const markets = await createMarkets(factories)
    const { cart } = await cartInMarket({ factories, service }, markets.unitedStates)
    await shipTo(service, cart.id, 'us')

    const { status, body } = await api.post<ApiErrorBody>(`/store/carts/${cart.id}`, {
      regionId: markets.colombia.region.id,
    })

    expect(status).toBe(400)
    expect(body).toMatchObject({ type: 'invalid_data' })
    expect(body.message).toContain('us')

    // The shopper keeps the market they were in, priced in its money.
    const detail = await readCart(cart.id)
    expect(detail.body.cart).toMatchObject({ regionId: markets.unitedStates.region.id, currencyCode: 'usd' })
    expect(detail.body.cart.items.map((item) => item.unitPrice)).toEqual([USD_PRICE])
  })

  test('adopts the only country the new market sells to', async ({ factories, service, expect }) => {
    const markets = await createMarkets(factories)
    const { cart } = await cartInMarket({ factories, service }, markets.unitedStates)

    await switchMarket(cart.id, markets.colombia)

    // With one country there is nothing to choose between, so the cart ships there rather than
    // waiting for an answer the shopper has no way to give differently.
    const detail = await readCart(cart.id)
    expect(detail.body.cart.shippingAddress).toMatchObject({ type: 'shipping', countryCode: 'co' })
  })

  test('leaves the country open when the new market sells to more than one', async ({ factories, service, expect }) => {
    const markets = await createMarkets(factories)
    await factories.create.country({ id: 'ec', regionId: markets.colombia.region.id })
    const { cart } = await cartInMarket({ factories, service }, markets.unitedStates)

    await switchMarket(cart.id, markets.colombia)

    const detail = await readCart(cart.id)
    expect(detail.body.cart.shippingAddress).toBeNull()
  })

  test('drops a country an earlier switch adopted when the new market does not sell to it', async ({
    factories,
    service,
    expect,
  }) => {
    const markets = await createMarkets(factories)
    const andes = await factories.create.region({ name: 'Andes', currencyCode: 'usd' })
    await factories.create.country({ id: 'ec', regionId: andes.id })
    await factories.create.country({ id: 'pe', regionId: andes.id })
    const { cart } = await cartInMarket({ factories, service }, markets.unitedStates)
    await switchMarket(cart.id, markets.colombia)

    const { status } = await api.post<StoreUpdateCartResponse>(`/store/carts/${cart.id}`, { regionId: andes.id })

    // `co` was the previous market's answer, not the shopper's, and the new market covers two
    // countries — so the cart is left with the question open rather than quoting Colombian rates.
    expect(status).toBe(200)
    const detail = await readCart(cart.id)
    expect(detail.body.cart.shippingAddress).toBeNull()
  })

  test('refuses a switch that would leave a line with no price, naming it', async ({ factories, service, expect }) => {
    const markets = await createMarkets(factories)
    const { cart, product } = await cartInMarket({ factories, service }, markets.unitedStates, {
      prices: [{ amount: USD_PRICE, currencyCode: 'usd' }],
    })

    const { status, body } = await api.post<ApiErrorBody>(`/store/carts/${cart.id}`, {
      regionId: markets.colombia.region.id,
    })

    expect(status).toBe(400)
    // Named, so the shopper is told which of their things cannot be sold there rather than
    // finding it silently gone from the bag.
    expect(body.message).toContain(product.title)
    expect(body.message).toContain('COP')

    const detail = await readCart(cart.id)
    expect(detail.body.cart).toMatchObject({ regionId: markets.unitedStates.region.id, currencyCode: 'usd' })
    expect(detail.body.cart.items.map((item) => item.unitPrice)).toEqual([USD_PRICE])
  })

  test('leaves a cart alone when the market named is the one it is already in', async ({
    factories,
    service,
    expect,
  }) => {
    const markets = await createMarkets(factories)
    const { cart } = await cartInMarket({ factories, service }, markets.unitedStates)
    await service.create.shippingMethod(api.container, cart.id, {
      name: 'US Standard',
      shippingOptionId: markets.unitedStates.shippingOption.id,
    })

    const { status } = await switchMarket(cart.id, markets.unitedStates)

    expect(status).toBe(200)
    const detail = await readCart(cart.id)
    expect(detail.body.cart.currencyCode).toBe('usd')
    expect(detail.body.cart.shippingMethods.map((method) => method.name)).toEqual(['US Standard'])
    expect(detail.body.cart.shippingAddress).toBeNull()
  })

  test('reports an unknown market as not found, leaving the cart in its own', async ({
    factories,
    service,
    expect,
  }) => {
    const markets = await createMarkets(factories)
    const { cart } = await cartInMarket({ factories, service }, markets.unitedStates)

    const { status } = await api.post<ApiErrorBody>(`/store/carts/${cart.id}`, { regionId: 'reg_nonexistent' })

    expect(status).toBe(404)
    const detail = await readCart(cart.id)
    expect(detail.body.cart).toMatchObject({ regionId: markets.unitedStates.region.id, currencyCode: 'usd' })
  })
})

/**
 * The same switch, asked for by country rather than by region id.
 *
 * This is the shape the storefront has: a market is a segment in its own URL, and the region and
 * the currency behind it are the backend's to know. Every assertion here is on what comes back —
 * the money the cart is now in and where it now ships — so it would survive the country-to-region
 * lookup moving anywhere else on this side of the wire.
 */
test.describe('POST /store/carts/:id — market switch named by country', () => {
  test('reprices the cart into the market that country belongs to', async ({ factories, service, expect }) => {
    const markets = await createMarkets(factories)
    const { cart } = await cartInMarket({ factories, service }, markets.unitedStates)

    const { status, body } = await switchToCountry(cart.id, markets.colombia.country.id)

    expect(status).toBe(200)
    expect(body.cart.currencyCode).toBe('cop')

    const detail = await readCart(cart.id)
    expect(detail.body.cart.items.map((item) => item.unitPrice)).toEqual([COP_PRICE])
    expect(detail.body.cart.totals.cartTotal).toBe('640000')
    // The country resolved a whole market and not just a currency: this is the region's own
    // country being adopted, which only the region knows about.
    expect(detail.body.cart.shippingAddress).toMatchObject({ countryCode: 'co' })
  })

  test('refuses a country no market sells to, leaving the cart in its own', async ({ factories, service, expect }) => {
    const markets = await createMarkets(factories)
    // A real ISO country with no region behind it — the store simply does not sell there. Same
    // answer as an unknown code, because to a storefront they are the same thing.
    await factories.create.country({ id: 'ec' })
    const { cart } = await cartInMarket({ factories, service }, markets.unitedStates)

    const { status, body } = await api.post<ApiErrorBody>(`/store/carts/${cart.id}`, { countryCode: 'ec' })

    expect(status).toBe(400)
    expect(body).toMatchObject({ type: 'invalid_data' })
    expect(body.message).toContain('ec')

    const detail = await readCart(cart.id)
    expect(detail.body.cart.currencyCode).toBe('usd')
    expect(detail.body.cart.items.map((item) => item.unitPrice)).toEqual([USD_PRICE])
  })

  test('leaves a cart alone when the country names the market it is already in', async ({
    factories,
    service,
    expect,
  }) => {
    const markets = await createMarkets(factories)
    const { cart } = await cartInMarket({ factories, service }, markets.unitedStates)
    await service.create.shippingMethod(api.container, cart.id, {
      name: 'US Standard',
      shippingOptionId: markets.unitedStates.shippingOption.id,
    })

    const { status } = await switchToCountry(cart.id, markets.unitedStates.country.id)

    // The storefront asks on every market entry, so the common answer is "already there". It has
    // to cost the shopper nothing: no reprice at the same numbers, and no shipping method dropped
    // and reoffered underneath them.
    expect(status).toBe(200)
    const detail = await readCart(cart.id)
    expect(detail.body.cart.currencyCode).toBe('usd')
    expect(detail.body.cart.shippingMethods.map((method) => method.name)).toEqual(['US Standard'])
  })
})

/**
 * The half of a market switch that cannot be carried out: a payment session already opened with
 * the provider. It carries its own amount and currency, taken off the collection when it was
 * opened, and the switch restates the collection without it — deleting it is a call to the
 * provider with nothing to compensate it with.
 *
 * So completion has to be where this is caught, and it has to be caught before authorization:
 * otherwise the shopper is charged the dollars they were quoted before the switch, for a cart
 * priced in pesos.
 */
test.describe('POST /store/carts/:id/complete — payment session and its collection', () => {
  test('refuses a cart whose payment session was opened in the money it has since left', async ({
    factories,
    service,
    expect,
  }) => {
    const markets = await createMarkets(factories)
    const product = await factories.create.productWithPricing({
      prices: [
        { amount: USD_PRICE, currencyCode: 'usd' },
        { amount: COP_PRICE, currencyCode: 'cop' },
      ],
    })
    // A shopper who got as far as picking a payment method, which is what opens the session.
    // Shipping is free so the two totals below are the line total and nothing else.
    const ready = await service.create.checkoutReadyCart(api.container, {
      cart: { regionId: markets.unitedStates.region.id, currencyCode: 'usd' },
      lineItem: {
        title: product.title,
        variantId: product.variant.id,
        quantity: 2,
        unitPrice: new BigNumber(USD_PRICE),
      },
      shippingMethod: { amount: new BigNumber(0) },
    })

    expect((await switchMarket(ready.cart.id, markets.colombia)).status).toBe(200)

    const { status, body } = await api.post<ApiErrorBody>(`/store/carts/${ready.cart.id}/complete`)

    expect(status).toBe(400)
    expect(body).toMatchObject({ type: 'invalid_data' })
    // Both sides named, so a shopper is told what disagrees rather than that something did, and
    // told the one thing that fixes it.
    expect(body.message).toContain('160 USD')
    expect(body.message).toContain('640000 COP')
    expect(body.message).toContain('select your payment method again')

    // Refused before anything was authorized or written: no order, and a cart still open.
    expect(await service.read.orders(api.container)).toHaveLength(0)
    expect(await service.read.cart(api.container, ready.cart.id)).toMatchObject({ completedAt: null })
  })
})
