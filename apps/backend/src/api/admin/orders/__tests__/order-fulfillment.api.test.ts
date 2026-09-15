import { ErrorTypes } from '@core/errors/app-error.js'
import type { OrderLineItemDTO } from '@core/types/order/common.js'
import type { ApiErrorBody, TestApi } from '@tests/setup/create-api.js'
import { type Fixtures, test } from '@tests/setup/test-extend.js'
import { assertDefined } from '@tests/utils/assert-defined.js'
import { completeCartWorkflow } from '@workflows/cart/complete-cart.js'
import type * as fulfillmentRoutes from '../[id]/fulfillments/route.js'
import orderDefinitions from '../definitions.js'

type Services = Fixtures['service']

let api: TestApi

test.beforeEach(async ({ createApi }) => {
  api = await createApi({ definitions: orderDefinitions })
})

/**
 * An order of two line items, only the first of which is tracked. Two lines is what makes a
 * partial request expressible — a request naming one of them covers part of the order — and the
 * second is untracked because it is there to be left out, not to be reserved.
 *
 * Built cart-first rather than through `service.create.order`, because checkout copies line items
 * onto the order, so the second one has to be on the cart before it runs.
 */
async function orderOfTwoLines(service: Services) {
  const checkout = await service.create.checkoutReadyCart(api.container)
  await service.create.lineItem(api.container, checkout.cart.id)
  const order = await completeCartWorkflow.run({ cartId: checkout.cart.id })
  assertDefined(checkout.inventoryItem)
  assertDefined(checkout.inventoryLevel)

  const lineItems = await service.read.orderLineItems(api.container, order.id)
  const [tracked] = lineItems.filter((item) => item.variantId === checkout.variantId)
  assertDefined(tracked)

  return {
    orderId: order.id,
    inventoryItemId: checkout.inventoryItem.id,
    locationId: checkout.inventoryLevel.locationId,
    lineItems,
    tracked,
  }
}

const cover = (lineItems: OrderLineItemDTO[]) =>
  lineItems.map((item) => ({ lineItemId: item.id, title: item.title, quantity: item.quantity }))

const fulfil = (orderId: string, body: object) =>
  api.post<typeof fulfillmentRoutes.PostOutput>(`/admin/orders/${orderId}/fulfillments`, body)

test.describe('POST /admin/orders/:id/fulfillments', () => {
  test('ships the whole order without being told where from', async ({ service, http, expect }) => {
    const { orderId, inventoryItemId, locationId, lineItems, tracked } = await orderOfTwoLines(service)

    const { status, body } = await fulfil(orderId, http.admin.createOrderFulfillment({ items: cover(lineItems) }))

    expect(status).toBe(200)
    expect(body.order.fulfillmentStatus).toBe('fulfilled')

    // The shopkeeper never picks a location, so the server has to answer it from the reservation.
    const link = await service.read.linkRepo(api.container, 'orderFulfillment').findByOrderId(orderId)
    assertDefined(link)
    expect(await service.read.fulfillment(api.container, link.fulfillmentId)).toMatchObject({ locationId })

    const [level] = await service.read.inventoryLevels(api.container, { inventoryItemId })
    expect(level).toMatchObject({ stockedQuantity: 0, reservedQuantity: 0 })
    expect(await service.read.reservationItems(api.container, { lineItemId: tracked.id })).toEqual([])
  })

  test('refuses a request that names only some of the order, and ships nothing', async ({ service, http, expect }) => {
    const { orderId, inventoryItemId, lineItems, tracked } = await orderOfTwoLines(service)
    const omitted = lineItems.filter((item) => item.id !== tracked.id)

    const { status, body } = await api.post<ApiErrorBody>(
      `/admin/orders/${orderId}/fulfillments`,
      http.admin.createOrderFulfillment({ items: cover([tracked]) }),
    )

    expect(status).toBe(400)
    expect(body.type).toBe(ErrorTypes.NOT_ALLOWED)
    expect(body.message).toContain('must cover every line item at its full quantity')
    expect(body.message).toContain(omitted[0]?.id ?? '')

    // The whole point of the refusal: the workflow marks the *order* fulfilled and de-reserves
    // every line on it, so accepting a subset would report a shipment that never went out.
    expect(await service.read.order(api.container, orderId)).toMatchObject({ fulfillmentStatus: 'unfulfilled' })
    const [level] = await service.read.inventoryLevels(api.container, { inventoryItemId })
    expect(level).toMatchObject({ stockedQuantity: tracked.quantity, reservedQuantity: tracked.quantity })
    expect(await service.read.reservationItems(api.container, { lineItemId: tracked.id })).toHaveLength(1)
  })

  test('refuses a fulfillment item that names no line item', async ({ service, http, expect }) => {
    const { orderId, tracked } = await orderOfTwoLines(service)

    const { status, body } = await api.post<ApiErrorBody>(`/admin/orders/${orderId}/fulfillments`, {
      ...http.admin.createOrderFulfillment(),
      items: [{ title: tracked.title, quantity: tracked.quantity }],
    })

    // Rejected by the schema rather than the workflow: an item on an order's fulfillment names the
    // line it fulfils, or the coverage rule above has nothing to count.
    expect(status).toBe(400)
    expect(body.type).toBe(ErrorTypes.INVALID_DATA)
    expect(body.message).toContain('lineItemId')
  })
})
