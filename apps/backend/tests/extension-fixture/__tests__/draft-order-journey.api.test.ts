import { BigNumber } from '@core/bignumber.js'
import { Modules } from '@core/utils/modules-definition.js'
import type {
  AdminDraftOrderListResponse,
  AdminDraftOrderResponse,
  AdminOrderActionResponse,
  AdminOrderListResponse,
  AdminOrderResponse,
} from '@proteus/http-schemas/admin'
import type {
  StoreCartDetailResponse,
  StoreCreateCartLineItemResponse,
  StoreCreateCartShippingMethodResponse,
  StoreCreateDraftOrderResponse,
  StoreOrderLookupResponse,
  StoreOrderResponse,
  StoreShippingOptionListResponse,
} from '@proteus/http-schemas/store'
import type { ApiErrorBody, TestApi } from '@tests/setup/create-api.js'
import { type Fixtures, test } from '@tests/setup/test-extend.js'
import draftOrderDefinitions from '../../../src/api/admin/draft-orders/definitions.js'
import orderDefinitions from '../../../src/api/admin/orders/definitions.js'
import cartDefinitions from '../../../src/api/store/carts/definitions.js'
import storeOrderDefinitions from '../../../src/api/store/orders/definitions.js'
import { FixtureModules } from '../fixture/keys.js'

const CITY_RATES_PROVIDER = 'fp_fixture_city_rates_default'
const definitions = [...cartDefinitions, ...storeOrderDefinitions, ...orderDefinitions, ...draftOrderDefinitions]
const draftOrdersOn = { projectConfig: { store: { draftOrders: true } } }

let api: TestApi

/**
 * A Colombian market whose courier is the fixture extension's calculated option, priced from its
 * rate table: Bogotá costs 8000 plus 2000 a unit. Two products, each stocked at one location.
 */
const createMarket = async ({ factories, service }: Pick<Fixtures, 'factories' | 'service'>) => {
  const region = await factories.create.region({ name: 'Colombia', currencyCode: 'cop' })
  await factories.create.country({ id: 'co', regionId: region.id })
  const courier = await factories.create.shippingOptionWithZone({
    geoZone: { type: 'country', countryCode: 'co' },
    shippingOption: { name: 'Courier', priceType: 'calculated', amount: null, providerId: CITY_RATES_PROVIDER },
  })
  await api.container.resolve(FixtureModules.SHIPPING_RATES).createShippingRates([
    { city: 'Bogotá', baseAmount: 8000, perItemAmount: 2000, deliveryDays: 2 },
    { city: 'Cali', baseAmount: 9000, perItemAmount: 1000, deliveryDays: 4 },
  ])

  const sneaker = await service.create.sellableVariant(api.container, {
    product: { title: 'Runner' },
    price: { amount: new BigNumber('100000'), currencyCode: 'cop' },
    inventory: { level: { stockedQuantity: 5 } },
  })
  const sandal = await service.create.sellableVariant(api.container, {
    product: { title: 'Sandal' },
    price: { amount: new BigNumber('50000'), currencyCode: 'cop' },
    inventory: { level: { stockedQuantity: 3 } },
  })

  return { region, courier, sneaker, sandal }
}

const bogotaAddress = (http: Fixtures['http']) =>
  http.store.cartAddress({ countryCode: 'CO', city: 'Bogotá', province: 'Cundinamarca', phone: '+57 300 123 4567' })

/** A Cart in the market holding these variants, shipped to Bogotá with a phone. */
const createBogotaCart = async (
  { http, service }: Pick<Fixtures, 'http' | 'service'>,
  regionId: string,
  lines: { variantId: string; quantity: number }[],
) => {
  const cart = await service.create.cart(api.container, { regionId, currencyCode: 'cop', email: null })
  const added = []
  for (const line of lines) {
    added.push((await api.post<StoreCreateCartLineItemResponse>(`/store/carts/${cart.id}/line-items`, line)).body)
  }
  await api.post(`/store/carts/${cart.id}`, { shippingAddress: bogotaAddress(http) })
  return { cart, lineItems: added.map((body) => body.lineItem) }
}

test.describe('draft orders, from the store Cart to a confirmed Order', () => {
  test.beforeEach(async ({ createApi }) => {
    api = await createApi({ definitions, config: draftOrdersOn })
  })

  // One long journey over many requests, each a workflow: the default budget is for one request, and
  // this matches the parity suite's, where every step is a Temporal round trip.
  test('a Cart sent to the shop is edited, re-priced and converted with its deposit', { timeout: 120_000 }, async ({
    factories,
    service,
    http,
    expect,
  }) => {
    const { region, courier, sneaker, sandal } = await createMarket({ factories, service })
    const { cart, lineItems } = await createBogotaCart({ http, service }, region.id, [
      { variantId: sneaker.variant.id, quantity: 1 },
    ])
    const readDraft = async (id: string) =>
      (await api.get<AdminDraftOrderResponse>(`/admin/draft-orders/${id}`)).body.draftOrder
    const readOrder = async (id: string) => (await api.get<AdminOrderResponse>(`/admin/orders/${id}`)).body.order
    const listOrderIds = async () =>
      (await api.get<AdminOrderListResponse>('/admin/orders')).body.orders.map((listed) => listed.id)
    const listOptions = async () =>
      (await api.get<StoreShippingOptionListResponse>(`/store/carts/${cart.id}/shipping-options`)).body.shippingOptions
    const readCartShipping = async () => {
      const read = (await api.get<StoreCartDetailResponse>(`/store/carts/${cart.id}`)).body.cart
      return { amounts: read.shippingMethods.map((method) => method.amount), shippingTotal: read.totals.shippingTotal }
    }

    // Bogotá is quoted by the courier from its rate table; a city it doesn't reach is offered nothing.
    expect(await listOptions()).toMatchObject([{ id: courier.id, priceType: 'calculated', amount: 10000 }])
    await api.post(`/store/carts/${cart.id}`, {
      shippingAddress: http.store.cartAddress({ countryCode: 'CO', city: 'Leticia', province: 'Amazonas' }),
    })
    expect(await listOptions()).toEqual([])
    await api.post(`/store/carts/${cart.id}`, { shippingAddress: bogotaAddress(http) })

    // The method keeps the provider's price and its data.
    const chosen = await api.post<StoreCreateCartShippingMethodResponse>(`/store/carts/${cart.id}/shipping-methods`, {
      shippingOptionId: courier.id,
    })
    expect(chosen.status).toBe(201)
    expect(chosen.body.shippingMethod).toMatchObject({ amount: '10000', data: { deliveryDays: 2 } })

    // A second unit re-quotes the parcel, and taking it out quotes it back.
    const runnerLineId = lineItems[0]?.id
    if (!runnerLineId) throw new Error('The Cart should hold the runner')
    await api.post(`/store/carts/${cart.id}/line-items/${runnerLineId}`, { quantity: 2 })
    expect(await readCartShipping()).toEqual({ amounts: ['12000'], shippingTotal: '12000' })
    await api.post(`/store/carts/${cart.id}/line-items/${runnerLineId}`, { quantity: 1 })
    expect(await readCartShipping()).toEqual({ amounts: ['10000'], shippingTotal: '10000' })

    // The Cart becomes a draft, closed in the same run.
    const sent = await api.post<StoreCreateDraftOrderResponse>(`/store/carts/${cart.id}/draft-order`)
    expect(sent.status).toBe(200)
    const draftId = sent.body.orderId
    expect((await service.read.cart(api.container, cart.id)).completedAt).not.toBeNull()

    // A closed Cart can't be changed, nor checked out as if the shop had confirmed it.
    const edit = await api.post<ApiErrorBody>(`/store/carts/${cart.id}/line-items`, {
      variantId: sandal.variant.id,
      quantity: 1,
    })
    expect(edit.status).toBe(400)
    expect(edit.body.type).toBe('not_allowed')
    const checkout = await api.post<ApiErrorBody>(`/store/carts/${cart.id}/complete`)
    expect(checkout.status).toBe(400)
    expect(checkout.body.message).toContain('draft order')

    // The shopper's link: the draft, its totals and nothing paid yet, without the email.
    const shared = (await api.get<StoreOrderResponse>(`/store/orders/${draftId}`)).body.order
    expect(shared).toMatchObject({
      status: 'draft',
      reference: sent.body.reference,
      paymentStatus: 'not_paid',
      totals: { itemsTotal: '100000', shippingTotal: '10000', orderTotal: '110000', paidTotal: '0' },
    })
    expect(shared.totals.outstandingTotal).toBe('110000')
    expect(shared).not.toHaveProperty('email')
    expect(shared).not.toHaveProperty('owner')

    // A shopper who lost the link finds it by number and the end of the phone, and only so.
    const lookup = (phoneLastDigits: string) =>
      api.post<StoreOrderLookupResponse>('/store/orders/lookup', { displayId: shared.displayId, phoneLastDigits })
    const found = await lookup('4567')
    expect(found.status).toBe(200)
    expect(found.body.id).toBe(draftId)
    expect((await lookup('4568')).status).toBe(404)

    // Not an order yet: the admin's orders list leaves it out.
    expect(await listOrderIds()).not.toContain(draftId)

    // What the shop opens: the Cart as stored, the courier's quote and data included, nothing reserved.
    const opened = await readDraft(draftId)
    expect(opened).toMatchObject({
      status: 'draft',
      isDraftOrder: true,
      email: null,
      reference: sent.body.reference,
      regionId: region.id,
      currencyCode: 'cop',
      shippingAddress: { city: 'Bogotá', phone: '+57 300 123 4567' },
      shippingMethods: [{ name: 'Courier', amount: '10000', isCustomAmount: false, data: { deliveryDays: 2 } }],
      totals: { itemsTotal: '100000', shippingTotal: '10000', orderTotal: '110000' },
    })
    expect(opened.lineItems).toMatchObject([{ title: 'Runner', quantity: 1, unitPrice: '100000' }])
    expect(lineItems[0]?.variantOptions).toEqual(opened.lineItems[0]?.variantOptions)
    expect(await service.read.reservationItems(api.container, {})).toEqual([])

    // The shop records the phone the shopper gave off-site; the city stays.
    const phoned = await api.post<AdminDraftOrderResponse>(`/admin/draft-orders/${draftId}`, {
      shippingAddress: { phone: '+57 311 000 0000' },
    })
    expect(phoned.status).toBe(200)
    expect(phoned.body.draftOrder.shippingAddress).toMatchObject({ city: 'Bogotá', phone: '+57 311 000 0000' })

    // Moved to Cali, the courier re-quotes the draft and its delivery estimate with it; back to Bogotá.
    const moved = await api.post<AdminDraftOrderResponse>(`/admin/draft-orders/${draftId}`, {
      shippingAddress: { city: 'Cali', province: 'Valle del Cauca' },
    })
    expect(moved.body.draftOrder.shippingMethods).toMatchObject([{ amount: '10000', data: { deliveryDays: 4 } }])
    const back = await api.post<AdminDraftOrderResponse>(`/admin/draft-orders/${draftId}`, {
      shippingAddress: { city: 'Bogotá', province: 'Cundinamarca' },
    })
    expect(back.body.draftOrder.shippingMethods).toMatchObject([{ amount: '10000', data: { deliveryDays: 2 } }])

    // Sending the same Cart again answers the same draft and overwrites none of the shop's edit.
    const again = await api.post<StoreCreateDraftOrderResponse>(`/store/carts/${cart.id}/draft-order`)
    expect(again.body.orderId).toBe(draftId)
    expect((await readDraft(draftId)).shippingAddress?.phone).toBe('+57 311 000 0000')

    // An added item is priced in the draft's region, and the courier re-quotes the parcel.
    const added = await api.post<AdminDraftOrderResponse>(`/admin/draft-orders/${draftId}/edit/items`, {
      items: [{ variantId: sandal.variant.id, quantity: 1 }],
    })
    expect(added.status).toBe(200)
    expect(added.body.draftOrder.lineItems.find((line) => line.title === 'Sandal')).toMatchObject({
      unitPrice: '50000',
      quantity: 1,
    })
    expect(added.body.draftOrder.totals).toMatchObject({ shippingTotal: '12000' })

    const runnerLine = added.body.draftOrder.lineItems.find((line) => line.title === 'Runner')
    const sandalLine = added.body.draftOrder.lineItems.find((line) => line.title === 'Sandal')
    if (!runnerLine || !sandalLine) throw new Error('Both lines should be on the draft')

    // Two runners: the quote follows the quantity.
    const raised = await api.post<AdminDraftOrderResponse>(
      `/admin/draft-orders/${draftId}/edit/items/item/${runnerLine.id}`,
      { quantity: 2 },
    )
    expect(raised.body.draftOrder.totals).toMatchObject({ itemsTotal: '250000', shippingTotal: '14000' })

    // The amount agreed with the shopper sticks through a later item edit.
    const agreed = await api.post<AdminDraftOrderResponse>(`/admin/draft-orders/${draftId}/edit/shipping-methods`, {
      shippingOptionId: courier.id,
      customAmount: '5000',
    })
    expect(agreed.body.draftOrder.shippingMethods).toMatchObject([{ amount: '5000', isCustomAmount: true }])
    const removed = await api.delete(`/admin/draft-orders/${draftId}/edit/items/item/${sandalLine.id}`)
    expect(removed.body).toEqual({ id: sandalLine.id, deleted: true })
    expect((await readDraft(draftId)).totals).toMatchObject({
      itemsTotal: '200000',
      shippingTotal: '5000',
      orderTotal: '205000',
    })

    // A draft takes no payment of its own: the deposit is recorded by converting it.
    const early = await api.post<ApiErrorBody>(`/admin/orders/${draftId}/payments`, { amount: '61500' })
    expect(early.status).toBe(400)
    expect(early.body.type).toBe('not_allowed')
    expect((await readOrder(draftId)).paymentCollections).toEqual([])

    // Converting with the deposit holds the stock and records the payment.
    const converted = await api.post<AdminOrderActionResponse>(`/admin/draft-orders/${draftId}/convert-to-order`, {
      paymentAmount: '61500',
    })
    expect(converted.status).toBe(200)
    expect(converted.body.order).toMatchObject({ id: draftId, status: 'pending', isDraftOrder: false })

    const [level] = await api.container
      .resolve(Modules.INVENTORY)
      .listInventoryLevels({ inventoryItemId: sneaker.inventoryItem?.id })
    expect(level).toMatchObject({ stockedQuantity: 5, reservedQuantity: 2 })

    const order = await readOrder(draftId)
    expect(order.paymentStatus).toBe('partially_captured')
    expect(order.paymentCollections).toHaveLength(1)
    expect(order.totals).toMatchObject({ orderTotal: '205000', paidTotal: '61500', outstandingTotal: '143500' })

    // It has left the drafts for the orders list.
    const drafts = (await api.get<AdminDraftOrderListResponse>('/admin/draft-orders')).body
    expect(drafts.draftOrders.map((draft) => draft.id)).not.toContain(draftId)
    expect(await listOrderIds()).toContain(draftId)

    // The rest, cash on delivery.
    await api.post(`/admin/orders/${draftId}/payments`, { amount: '143500' })
    const paid = await readOrder(draftId)
    expect(paid.paymentStatus).toBe('captured')
    expect(paid.totals).toMatchObject({ paidTotal: '205000', outstandingTotal: '0' })
    // The shopper's link reads the same money, and the confirmation apart from it.
    expect((await api.get<StoreOrderResponse>(`/store/orders/${draftId}`)).body.order).toMatchObject({
      status: 'pending',
      paymentStatus: 'captured',
      totals: { paidTotal: '205000', outstandingTotal: '0' },
    })

    // A second Cart's draft the shop won't fulfil: canceled, and the shopper's link says so.
    const second = await createBogotaCart({ http, service }, region.id, [{ variantId: sandal.variant.id, quantity: 1 }])
    const secondDraft = await api.post<StoreCreateDraftOrderResponse>(`/store/carts/${second.cart.id}/draft-order`)
    const link = `/store/orders/${secondDraft.body.orderId}`
    expect((await api.get<StoreOrderResponse>(link)).body.order).toMatchObject({
      status: 'draft',
      paymentStatus: 'not_paid',
      totals: { paidTotal: '0' },
    })
    expect((await api.get<StoreOrderResponse>(link)).body.order).not.toHaveProperty('owner')
    const canceled = await api.post(`/admin/orders/${secondDraft.body.orderId}/cancel`)
    expect(canceled.status).toBe(200)
    expect((await api.get<StoreOrderResponse>(link)).body.order.status).toBe('canceled')

    // A third, converted on its deposit, then canceled with part of the deposit returned.
    const third = await createBogotaCart({ http, service }, region.id, [{ variantId: sandal.variant.id, quantity: 1 }])
    await api.post(`/store/carts/${third.cart.id}/shipping-methods`, { shippingOptionId: courier.id })
    const thirdDraft = await api.post<StoreCreateDraftOrderResponse>(`/store/carts/${third.cart.id}/draft-order`)
    const thirdId = thirdDraft.body.orderId
    await api.post(`/admin/draft-orders/${thirdId}/convert-to-order`, { paymentAmount: '30000' })
    const keptPart = await api.post(`/admin/orders/${thirdId}/cancel`, { refundAmount: '10000' })
    expect(keptPart.status).toBe(200)
    const thirdOrder = await readOrder(thirdId)
    expect(thirdOrder).toMatchObject({ status: 'canceled', paymentStatus: 'partially_refunded' })
    expect(thirdOrder.totals).toMatchObject({ orderTotal: '60000', paidTotal: '20000' })
  })

  test('refuses an unsellable line by name, at sending and at converting, and converts unpaid once it is back', async ({
    factories,
    service,
    http,
    expect,
  }) => {
    const { region, sneaker, sandal } = await createMarket({ factories, service })
    const inventoryService = api.container.resolve(Modules.INVENTORY)
    const stockAt = (variant: typeof sneaker, quantity: number) => {
      const { inventoryItem, inventoryLevel } = variant
      if (!inventoryItem || !inventoryLevel) throw new Error('The variant should be stocked')
      return inventoryService.setInventoryLevelStockedQuantity(inventoryItem.id, inventoryLevel.locationId, quantity)
    }

    // Sold out since it went into the Cart: refused by name, and the Cart stays open to fix.
    const soldOut = await createBogotaCart({ http, service }, region.id, [
      { variantId: sneaker.variant.id, quantity: 2 },
    ])
    await stockAt(sneaker, 1)
    const refused = await api.post<ApiErrorBody>(`/store/carts/${soldOut.cart.id}/draft-order`)
    expect(refused.status).toBe(409)
    expect(refused.body.message).toContain('"Runner" is sold out')
    expect((await service.read.cart(api.container, soldOut.cart.id)).completedAt).toBeNull()

    // An item the catalogue no longer holds.
    const discontinued = await createBogotaCart({ http, service }, region.id, [
      { variantId: sandal.variant.id, quantity: 1 },
    ])
    await api.container.resolve(Modules.PRODUCT).softDeleteProductVariants([sandal.variant.id])
    const gone = await api.post<ApiErrorBody>(`/store/carts/${discontinued.cart.id}/draft-order`)
    expect(gone.status).toBe(409)
    expect(gone.body.message).toContain('"Sandal" is no longer sold')

    // Sold out after the draft was made: converting takes neither stock nor money.
    await stockAt(sneaker, 5)
    const cart = await createBogotaCart({ http, service }, region.id, [{ variantId: sneaker.variant.id, quantity: 2 }])
    const draft = await api.post<StoreCreateDraftOrderResponse>(`/store/carts/${cart.cart.id}/draft-order`)
    await stockAt(sneaker, 1)
    const convert = await api.post<ApiErrorBody>(`/admin/draft-orders/${draft.body.orderId}/convert-to-order`, {
      paymentAmount: '1000',
    })
    expect(convert.status).toBe(409)
    expect(convert.body.message).toContain('"Runner" is sold out')
    const stillDraft = (await api.get<AdminOrderResponse>(`/admin/orders/${draft.body.orderId}`)).body.order
    expect(stillDraft).toMatchObject({ status: 'draft', paymentCollections: [] })
    expect(await service.read.reservationItems(api.container, {})).toEqual([])

    // Back in stock, and the shop confirms without a deposit: the stock is held and the Order
    // gets its one collection, with nothing received.
    await stockAt(sneaker, 5)
    const unpaid = await api.post<AdminOrderActionResponse>(
      `/admin/draft-orders/${draft.body.orderId}/convert-to-order`,
    )
    expect(unpaid.status).toBe(200)
    const confirmed = (await api.get<AdminOrderResponse>(`/admin/orders/${draft.body.orderId}`)).body.order
    expect(confirmed).toMatchObject({ status: 'pending', paymentStatus: 'not_paid', totals: { paidTotal: '0' } })
    expect(confirmed.paymentCollections).toHaveLength(1)
    expect(await service.read.reservationItems(api.container, {})).toHaveLength(1)
  })

  test('deletes a draft, and only a draft', async ({ service, expect }) => {
    const draft = await service.create.draftOrder(api.container)
    const { order } = await service.create.order(api.container)

    const refused = await api.delete<ApiErrorBody>(`/admin/draft-orders/${order.id}`)
    expect(refused.status).toBe(400)
    expect(refused.body.type).toBe('not_allowed')
    expect((await api.get(`/admin/orders/${order.id}`)).status).toBe(200)

    const deleted = await api.delete(`/admin/draft-orders/${draft.id}`)
    expect(deleted.body).toEqual({ id: draft.id, deleted: true })
    expect((await api.get(`/admin/draft-orders/${draft.id}`)).status).toBe(404)
  })
})

test('the store route is not there when the store takes no draft orders', async ({ createApi, service, expect }) => {
  api = await createApi({ definitions })
  const cart = await service.create.cart(api.container)

  const refused = await api.post<ApiErrorBody>(`/store/carts/${cart.id}/draft-order`)
  expect(refused.status).toBe(404)
  expect((await service.read.cart(api.container, cart.id)).completedAt).toBeNull()
})
