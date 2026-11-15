import { BigNumber } from '@core/bignumber.js'
import type {
  StoreLookupOrderBody,
  StoreOrderListResponse,
  StoreOrderLookupResponse,
  StoreOrderResponse,
} from '@proteus/http-schemas/store'
import type { ApiErrorBody, TestApi } from '@tests/setup/create-api.js'
import { test } from '@tests/setup/test-extend.js'
import { assertDefined } from '@tests/utils/assert-defined.js'
import { authHeader } from '@tests/utils/auth-header.js'
import orderDefinitions from '../definitions.js'

let api: TestApi

// `namespaceAuth` is what puts the real `authenticate` middleware in front of these routes, and
// it is the whole subject of half this file: the list route refuses a guest, and the detail route
// admits one but hides an order belonging to somebody else.
test.beforeEach(async ({ createApi }) => {
  api = await createApi({ definitions: orderDefinitions, namespaceAuth: true })
})

const retrieve = (orderId: string, headers?: Record<string, string>) =>
  api.get<StoreOrderResponse | ApiErrorBody>(`/store/orders/${orderId}`, undefined, { headers })

const lookup = (body: StoreLookupOrderBody) =>
  api.post<StoreOrderLookupResponse | ApiErrorBody>('/store/orders/lookup', body)

const list = (headers?: Record<string, string>) =>
  api.get<StoreOrderListResponse | ApiErrorBody>('/store/orders', undefined, { headers })

test.describe('GET /store/orders/:id', () => {
  /**
   * The shopper's shareable link: anyone holding the id reads it without signing in, so what it
   * answers is an allowlist. The paid and outstanding amounts come from the order's transactions,
   * which is what a shopper who paid a deposit needs to see.
   */
  test('a guest reads the order without its email, street or phone', async ({ service, expect, dto }) => {
    const street = 'Calle 10 #43-12'
    const option = { optionTitle: 'Size', renderAs: 'text' as const, value: '41' }
    const customer = await service.create.customer(api.container)
    const { order } = await service.create.order(api.container, {
      cart: { customerId: customer.id },
      lineItem: { variantOptions: [option] },
      addresses: {
        shippingAddress: dto.generate.createCartAddress({
          address1: street,
          city: 'Medellín',
          province: 'Antioquia',
          phone: '+57 300 123 9876',
        }),
      },
    })
    await service.create.orderTransaction(api.container, order.id, { amount: new BigNumber(300) })
    const transactions = await service.read.orderTransactions(api.container, order.id)
    const paidTotal = transactions.reduce((sum, transaction) => sum.plus(transaction.amount), new BigNumber(0))

    const { status, body } = await retrieve(order.id)

    expect(status).toBe(200)
    const read = 'order' in body ? body.order : undefined
    assertDefined(read)
    expect(read).toMatchObject({
      id: order.id,
      reference: String(order.displayId),
      status: 'pending',
      fulfillmentStatus: 'unfulfilled',
      lineItems: [{ variantOptions: [option] }],
      totals: { paidTotal: paidTotal.toString() },
    })
    expect(read.shippingAddress).toEqual({ city: 'Medellín', province: 'Antioquia' })
    expect(read.totals.outstandingTotal).toBe(new BigNumber(read.totals.orderTotal).minus(paidTotal).toString())
    expect(read).not.toHaveProperty('email')
    expect(read).not.toHaveProperty('owner')
    const serialized = JSON.stringify(body)
    expect(serialized).not.toContain(order.email ?? 'an email')
    expect(serialized).not.toContain(street)
    expect(serialized).not.toContain('9876')

    // The customer who placed it reads the same order, and what only they may see beside it.
    const asOwner = await retrieve(order.id, authHeader('customer', customer.id))
    expect(asOwner.body).toMatchObject({
      order: { id: order.id, owner: { email: order.email, shippingAddress: { address1: street } } },
    })
  })

  test('a draft is readable by its id too', async ({ service, expect }) => {
    const draft = await service.create.draftOrder(api.container)

    const { status, body } = await retrieve(draft.id)

    expect(status).toBe(200)
    expect(body).toMatchObject({ order: { id: draft.id, status: 'draft', reference: String(draft.displayId) } })
  })

  test('returns a null address when the checkout never set one', async ({ service, expect }) => {
    const { order } = await service.create.order(api.container)

    const { status, body } = await retrieve(order.id)

    expect(status).toBe(200)
    expect(body).toMatchObject({ order: { id: order.id, shippingAddress: null } })
  })

  test('returns the line items and shipping methods the order owns', async ({ service, expect }) => {
    const { order, lineItem, shippingMethod } = await service.create.order(api.container)

    const { body } = await retrieve(order.id)

    expect(body).toMatchObject({
      order: {
        lineItems: [{ title: lineItem.title, quantity: lineItem.quantity }],
        shippingMethods: [{ name: shippingMethod.name }],
      },
    })
  })

  test('carries the line item id and its option values', async ({ service, expect }) => {
    const { order } = await service.create.order(api.container, { lineItem: { variantOptionValues: 'M · Olive' } })
    const [orderLineItem] = await service.read.orderLineItems(api.container, order.id)
    assertDefined(orderLineItem)

    const { body } = await retrieve(order.id)

    // Both keys were dropped by the response schema until the order page needed them: the id is
    // what the storefront keys a row by, and the option values are what it prints under the title.
    expect(body).toMatchObject({
      order: { lineItems: [{ id: orderLineItem.id, variantOptionValues: 'M · Olive' }] },
    })
  })

  test('hides an order that belongs to another customer', async ({ service, expect }) => {
    const customer = await service.create.customer(api.container)
    const other = await service.create.customer(api.container)
    const { order } = await service.create.order(api.container, { cart: { customerId: customer.id } })

    const { status, body } = await retrieve(order.id, authHeader('customer', other.id))

    // Deliberately 404 rather than 403: a customer probing ids learns nothing about which of them exist.
    expect(status).toBe(404)
    expect(body).toMatchObject({ type: 'not_found' })
  })

  test('returns 404 for an order that does not exist', async ({ expect }) => {
    const { status, body } = await retrieve('ord_nonexistent')

    expect(status).toBe(404)
    expect(body).toMatchObject({ type: 'not_found' })
  })
})

test.describe('POST /store/orders/lookup', () => {
  /**
   * The way back to an order for a shopper who lost its link. Every miss — wrong digits, an order
   * with no phone, a number no order has — must answer the same, or the lookup tells a stranger
   * which order numbers exist.
   */
  test('answers the id only for the last 4 digits of the shipping phone', async ({ service, expect, dto }) => {
    const { order } = await service.create.order(api.container, {
      addresses: { shippingAddress: dto.generate.createCartAddress({ phone: '+57 (300) 123-4567' }) },
    })
    const { order: withoutPhone } = await service.create.order(api.container, {
      addresses: { shippingAddress: dto.generate.createCartAddress({ phone: null }) },
    })

    const found = await lookup({ displayId: order.displayId, phoneLastDigits: '4567' })
    const wrongDigits = await lookup({ displayId: order.displayId, phoneLastDigits: '4568' })
    const noPhone = await lookup({ displayId: withoutPhone.displayId, phoneLastDigits: '4567' })
    const unknownNumber = await lookup({ displayId: order.displayId + 1000, phoneLastDigits: '4567' })

    expect(found).toEqual({ status: 200, body: { id: order.id } })
    expect(wrongDigits).toMatchObject({ status: 404, body: { type: 'not_found' } })
    expect(noPhone).toEqual(wrongDigits)
    expect(unknownNumber).toEqual(wrongDigits)
  })
})

test.describe('GET /store/orders', () => {
  test('refuses a guest', async ({ expect }) => {
    const { status, body } = await list()

    expect(status).toBe(401)
    expect(body).toMatchObject({ type: 'unauthorized' })
  })

  test("returns only the authenticated customer's orders", async ({ service, expect }) => {
    // A second customer with an order of their own is what makes the filter observable: without
    // one, an unfiltered read would return the same single order and the test could not fail.
    const customer = await service.create.customer(api.container)
    const other = await service.create.customer(api.container)
    const { order: mine } = await service.create.order(api.container, { cart: { customerId: customer.id } })
    await service.create.order(api.container, { cart: { customerId: other.id } })
    // The shop has not confirmed a draft, so it is not part of the customer's history.
    await service.create.draftOrder(api.container, { customerId: customer.id })

    const { status, body } = await list(authHeader('customer', customer.id))

    expect(status).toBe(200)
    expect(body).toMatchObject({ count: 1, orders: [{ id: mine.id, reference: String(mine.displayId) }] })
  })

  test('summarises each order with the items it contains', async ({ service, expect }) => {
    const customer = await service.create.customer(api.container)
    const { order, lineItem } = await service.create.order(api.container, { cart: { customerId: customer.id } })

    const { body } = await list(authHeader('customer', customer.id))

    const [orderLineItem] = await service.read.orderLineItems(api.container, order.id)
    assertDefined(orderLineItem)

    // The id is in the summary for the same reason it is in the detail: the thumbnail strip keys
    // by it, and two variants of one product share a title.
    expect(body).toMatchObject({
      orders: [{ id: order.id, items: [{ id: orderLineItem.id, title: lineItem.title, quantity: lineItem.quantity }] }],
    })
  })
})
