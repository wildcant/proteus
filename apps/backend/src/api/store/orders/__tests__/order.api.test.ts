import type { StoreOrderListResponse, StoreOrderResponse } from '@proteus/http-schemas/store'
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

const list = (headers?: Record<string, string>) =>
  api.get<StoreOrderListResponse | ApiErrorBody>('/store/orders', undefined, { headers })

test.describe('GET /store/orders/:id', () => {
  test('returns the order with the address it owns', async ({ service, expect, dto }) => {
    const { order } = await service.create.order(api.container, {
      addresses: { shippingAddress: dto.generate.createCartAddress({ firstName: 'Ada', city: 'Springfield' }) },
    })

    const { status, body } = await retrieve(order.id)

    expect(status).toBe(200)
    expect(body).toMatchObject({
      order: {
        id: order.id,
        shippingAddress: { firstName: 'Ada', city: 'Springfield' },
      },
    })
  })

  test('the address carries no trace of the row that holds it', async ({ service, expect, dto }) => {
    const { order } = await service.create.order(api.container, {
      addresses: { shippingAddress: dto.generate.createCartAddress() },
    })

    const { body } = await retrieve(order.id)
    const shippingAddress = 'order' in body ? body.order.shippingAddress : null

    // `orderId` and `type` are what the inversion added to make the address an owned child. They
    // are how the order finds its address, not something a storefront has any use for.
    expect(shippingAddress).not.toBeNull()
    expect(shippingAddress).not.toHaveProperty('id')
    expect(shippingAddress).not.toHaveProperty('orderId')
    expect(shippingAddress).not.toHaveProperty('type')
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

  test('a guest may retrieve an order', async ({ service, expect }) => {
    const { order } = await service.create.order(api.container)

    const { status } = await retrieve(order.id)

    expect(status).toBe(200)
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

    const { status, body } = await list(authHeader('customer', customer.id))

    expect(status).toBe(200)
    expect(body).toMatchObject({ count: 1, orders: [{ id: mine.id }] })
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
