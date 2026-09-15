import type { EventBus } from '@core/event-bus/types.js'
import type { CreateLineItemDTO } from '@core/types/cart/mutations.js'
import type { CreateFulfillmentDTO } from '@core/types/fulfillment/mutations.js'
import type { IInventoryModuleService } from '@core/types/inventory/service.js'
import type { OrderLineItemDTO } from '@core/types/order/common.js'
import { ContainerRegistrationKeys } from '@core/utils/container.js'
import { Modules } from '@core/utils/modules-definition.js'
import type { TestContainer } from '@tests/setup/create-container.js'
import { type Fixtures, test } from '@tests/setup/test-extend.js'
import { assertDefined } from '@tests/utils/assert-defined.js'
import { vi } from 'vitest'
import { completeCartWorkflow } from '../../cart/complete-cart.js'
import { createOrderFulfillmentWorkflow } from '../create-order-fulfillment.js'

type Services = Fixtures['service']

let container: TestContainer

test.beforeEach(async ({ createTestContainer }) => {
  container = await createTestContainer()
})

/** The provider and address every request carries and no test asserts on. */
const shipment = { providerId: 'manual', address: { firstName: 'John', lastName: 'Doe' } }

/** Line items named at their full quantity — the shape of request the workflow accepts. */
const cover = (lineItems: OrderLineItemDTO[]): CreateFulfillmentDTO['items'] =>
  lineItems.map((item) => ({ lineItemId: item.id, title: item.title, quantity: item.quantity }))

type PlacedOrderOptions = { quantity?: number; stockedQuantity?: number; requiredQuantity?: number }

/**
 * An order waiting to be shipped: placed through checkout, so its units are committed to it by a
 * reservation at a real Stock Location — the arrangement fulfillment is unreachable without.
 */
async function placedOrder(service: Services, options: PlacedOrderOptions = {}) {
  const checkout = await service.create.order(container, {
    lineItem: { quantity: options.quantity ?? 1 },
    inventory: {
      ...(options.requiredQuantity ? { requiredQuantity: options.requiredQuantity } : {}),
      ...(options.stockedQuantity ? { level: { stockedQuantity: options.stockedQuantity } } : {}),
    },
  })
  assertDefined(checkout.inventoryItem)
  assertDefined(checkout.inventoryLevel)

  return {
    orderId: checkout.order.id,
    inventoryItemId: checkout.inventoryItem.id,
    locationId: checkout.inventoryLevel.locationId,
    lineItems: await service.read.orderLineItems(container, checkout.order.id),
  }
}

/**
 * An order of two line items, which is what makes a partial request expressible at all: a request
 * naming one of them covers part of the order. Only the first is tracked — the second is there to
 * be left out, and stock behind it would add a reservation no assertion here is about.
 *
 * Built cart-first rather than through `service.create.order`, because checkout copies line items
 * onto the order and a second one therefore has to be on the cart before it runs.
 */
async function orderOfTwoLines(service: Services, second?: Partial<CreateLineItemDTO>) {
  const checkout = await service.create.checkoutReadyCart(container)
  await service.create.lineItem(container, checkout.cart.id, second)
  const order = await completeCartWorkflow.run({ cartId: checkout.cart.id })
  assertDefined(checkout.inventoryItem)

  const lineItems = await service.read.orderLineItems(container, order.id)
  const [tracked] = lineItems.filter((item) => item.variantId === checkout.variantId)
  assertDefined(tracked)
  const [untracked] = lineItems.filter((item) => item.variantId !== checkout.variantId)
  assertDefined(untracked)

  return { orderId: order.id, inventoryItemId: checkout.inventoryItem.id, lineItems, tracked, untracked }
}

/** Stocked, reserved and available for one item, as a single object to assert against. */
async function stockOf(service: Services, inventoryItemId: string) {
  const [level] = await service.read.inventoryLevels(container, { inventoryItemId })
  assertDefined(level)

  return {
    stockedQuantity: level.stockedQuantity,
    reservedQuantity: level.reservedQuantity,
    availableQuantity: await service.read.availableQuantity(container, inventoryItemId),
  }
}

/** The fulfillment the workflow created, which it does not hand back. */
async function fulfillmentOf(service: Services, orderId: string) {
  const link = await service.read.linkRepo(container, 'orderFulfillment').findByOrderId(orderId)
  assertDefined(link)

  return service.read.fulfillment(container, link.fulfillmentId)
}

test.describe('createOrderFulfillmentWorkflow', () => {
  test('takes the order off the shelf: stock down, reservation gone, order fulfilled', async ({ service, expect }) => {
    const { orderId, inventoryItemId, lineItems } = await placedOrder(service, { quantity: 3, stockedQuantity: 10 })

    const order = await createOrderFulfillmentWorkflow.run({
      orderId,
      fulfillmentData: { ...shipment, items: cover(lineItems) },
    })

    expect(order.fulfillmentStatus).toBe('fulfilled')
    expect(await service.read.order(container, orderId)).toMatchObject({ fulfillmentStatus: 'fulfilled' })

    // The units left the warehouse rather than staying committed to the order: stocked falls by
    // what shipped and the reservation holding them is gone, so available stays where it was.
    expect(await stockOf(service, inventoryItemId)).toEqual({
      stockedQuantity: 7,
      reservedQuantity: 0,
      availableQuantity: 7,
    })
    expect(await service.read.reservationItems(container, { lineItemId: lineItems.map((item) => item.id) })).toEqual([])
  })

  /**
   * Fulfillment is the second of the three ways stock moves down, and it announces every level it
   * touched — without asking whether Available Quantity actually fell. Taking units off the shelf
   * and releasing their reservation move stocked and reserved by the same amount, so what changed
   * is which number holds them; whether that is worth telling anyone about is the subscriber's one
   * comparison to make, and it is covered in `subscribers/__tests__/alert-low-stock.test.ts`.
   *
   * Published from the last step rather than from `adjust-inventory`, so a failure below it
   * compensates the adjustment away before anything was announced.
   */
  test('announces the level the adjustment moved, with the quantities the write left behind', async ({
    service,
    expect,
  }) => {
    const { orderId, inventoryItemId, lineItems } = await placedOrder(service, { quantity: 3, stockedQuantity: 10 })
    const [level] = await service.read.inventoryLevels(container, { inventoryItemId })
    assertDefined(level)
    const bus = container.resolve<EventBus>(ContainerRegistrationKeys.EVENT_BUS)
    const emit = vi.spyOn(bus, 'emit')

    await createOrderFulfillmentWorkflow.run({
      orderId,
      fulfillmentData: { ...shipment, items: cover(lineItems) },
    })

    expect(emit).toHaveBeenCalledWith('inventory.available_decreased', {
      id: level.id,
      version: expect.any(Number),
      stockedQuantity: 7,
      reservedQuantity: 0,
    })
  })

  test('ships from the location the stock is reserved at when the request names none', async ({ service, expect }) => {
    const { orderId, locationId, lineItems } = await placedOrder(service)

    await createOrderFulfillmentWorkflow.run({ orderId, fulfillmentData: { ...shipment, items: cover(lineItems) } })

    // Resolved rather than left null: a reservation can only be written where a level exists, so
    // this is the one location that could have held the units that just shipped.
    expect(await fulfillmentOf(service, orderId)).toMatchObject({ locationId })
  })

  test('records the location the request names when it agrees with the reservation', async ({ service, expect }) => {
    const { orderId, locationId, lineItems } = await placedOrder(service)

    await createOrderFulfillmentWorkflow.run({
      orderId,
      fulfillmentData: { ...shipment, locationId, items: cover(lineItems) },
    })

    expect(await fulfillmentOf(service, orderId)).toMatchObject({ locationId })
  })

  test('refuses a location the order holds no stock at, and ships nothing', async ({ service, expect }) => {
    const { orderId, inventoryItemId, lineItems } = await placedOrder(service, { quantity: 2 })
    const elsewhere = await service.create.stockLocation(container)

    await expect(
      createOrderFulfillmentWorkflow.run({
        orderId,
        fulfillmentData: { ...shipment, locationId: elsewhere.id, items: cover(lineItems) },
      }),
    ).rejects.toThrow(`Cannot fulfill order ${orderId} from location "${elsewhere.id}"`)

    expect(await service.read.order(container, orderId)).toMatchObject({ fulfillmentStatus: 'unfulfilled' })
    expect(await stockOf(service, inventoryItemId)).toMatchObject({ stockedQuantity: 2, reservedQuantity: 2 })
  })

  test('refuses a request that names only part of the order, and moves no stock', async ({ service, expect }) => {
    const { orderId, inventoryItemId, tracked, untracked } = await orderOfTwoLines(service)

    await expect(
      createOrderFulfillmentWorkflow.run({ orderId, fulfillmentData: { ...shipment, items: cover([tracked]) } }),
    ).rejects.toThrow(`"${untracked.id}" asked for 0 of ${untracked.quantity}`)

    // Accepting it would mark the whole order fulfilled and de-reserve every line on it, so the
    // shopkeeper would be told a shipment went out that is still on the shelf.
    expect(await service.read.order(container, orderId)).toMatchObject({ fulfillmentStatus: 'unfulfilled' })
    expect(await stockOf(service, inventoryItemId)).toMatchObject({ reservedQuantity: tracked.quantity })
    expect(await service.read.reservationItems(container, { lineItemId: tracked.id })).toHaveLength(1)
  })

  test('refuses a request that covers a line item below its full quantity', async ({ service, expect }) => {
    const { orderId, lineItems } = await placedOrder(service, { quantity: 3 })
    const [lineItem] = lineItems
    assertDefined(lineItem)

    await expect(
      createOrderFulfillmentWorkflow.run({
        orderId,
        fulfillmentData: { ...shipment, items: [{ lineItemId: lineItem.id, title: lineItem.title, quantity: 1 }] },
      }),
    ).rejects.toThrow(`"${lineItem.id}" asked for 1 of 3`)
  })

  test('refuses an item that names no line item at all', async ({ service, expect }) => {
    const { orderId, lineItems } = await placedOrder(service)
    const [lineItem] = lineItems
    assertDefined(lineItem)

    await expect(
      createOrderFulfillmentWorkflow.run({
        orderId,
        fulfillmentData: { ...shipment, items: [{ title: lineItem.title, quantity: lineItem.quantity }] },
      }),
    ).rejects.toThrow(`names no line item of order ${orderId}`)
  })

  test('refuses an item naming a line item from another order', async ({ service, expect }) => {
    const { orderId } = await placedOrder(service)
    const other = await placedOrder(service)

    await expect(
      createOrderFulfillmentWorkflow.run({ orderId, fulfillmentData: { ...shipment, items: cover(other.lineItems) } }),
    ).rejects.toThrow(`does not exist in order ${orderId}`)
  })

  test('deducts requiredQuantity units of stock per unit ordered', async ({ service, expect }) => {
    const { orderId, inventoryItemId, lineItems } = await placedOrder(service, {
      quantity: 2,
      requiredQuantity: 3,
      stockedQuantity: 30,
    })

    await createOrderFulfillmentWorkflow.run({ orderId, fulfillmentData: { ...shipment, items: cover(lineItems) } })

    // 2 ordered × 3 units each — not the line item's 2, and not the reservation read as a total.
    expect(await stockOf(service, inventoryItemId)).toMatchObject({ stockedQuantity: 24, reservedQuantity: 0 })
  })

  test('refuses a tracked line item that has no reservation behind it', async ({ service, expect }) => {
    // Untracked when the order was placed, so nothing was reserved, and tracked afterwards — the
    // shape of a variant that started being managed while an order for it was already open.
    const checkout = await service.create.order(container, { inventory: null })
    assertDefined(checkout.variantId)
    await service.create.trackedVariantWithoutStock(container, { variantId: checkout.variantId })
    const lineItems = await service.read.orderLineItems(container, checkout.order.id)

    await expect(
      createOrderFulfillmentWorkflow.run({
        orderId: checkout.order.id,
        fulfillmentData: { ...shipment, items: cover(lineItems) },
      }),
    ).rejects.toThrow('No reservation found for managed-inventory item')

    expect(await service.read.order(container, checkout.order.id)).toMatchObject({ fulfillmentStatus: 'unfulfilled' })
  })

  test('refuses an order whose items disagree about shipping', async ({ service, expect }) => {
    const { orderId, lineItems } = await orderOfTwoLines(service, { requiresShipping: false })

    await expect(
      createOrderFulfillmentWorkflow.run({ orderId, fulfillmentData: { ...shipment, items: cover(lineItems) } }),
    ).rejects.toThrow('mixed shipping requirements')
  })

  test('refuses an order that is not pending', async ({ service, expect }) => {
    const { orderId, lineItems } = await placedOrder(service)
    await service.update.order(container, orderId, { status: 'canceled' })

    await expect(
      createOrderFulfillmentWorkflow.run({ orderId, fulfillmentData: { ...shipment, items: cover(lineItems) } }),
    ).rejects.toThrow('status is "canceled", expected "pending"')
  })

  test('refuses an order that has already been fulfilled', async ({ service, expect }) => {
    const { orderId, lineItems } = await placedOrder(service)
    await service.create.fulfilledOrder(container, orderId)

    await expect(
      createOrderFulfillmentWorkflow.run({ orderId, fulfillmentData: { ...shipment, items: cover(lineItems) } }),
    ).rejects.toThrow('fulfillment status is "fulfilled", expected "unfulfilled"')
  })

  test('rollback puts the stock, the reservation and the order back when the adjustment fails', async ({
    service,
    expect,
  }) => {
    const { orderId, inventoryItemId, lineItems } = await placedOrder(service, { quantity: 2, stockedQuantity: 5 })

    vi.spyOn(
      container.resolve<IInventoryModuleService>(Modules.INVENTORY),
      'adjustInventoryLevel',
    ).mockRejectedValueOnce(new Error('inventory unavailable'))

    await expect(
      createOrderFulfillmentWorkflow.run({ orderId, fulfillmentData: { ...shipment, items: cover(lineItems) } }),
    ).rejects.toThrow('inventory unavailable')

    expect(await service.read.order(container, orderId)).toMatchObject({ fulfillmentStatus: 'unfulfilled' })
    expect(await stockOf(service, inventoryItemId)).toEqual({
      stockedQuantity: 5,
      reservedQuantity: 2,
      availableQuantity: 3,
    })
    expect(
      await service.read.reservationItems(container, { lineItemId: lineItems.map((item) => item.id) }),
    ).toHaveLength(1)
    expect(await service.read.linkRepo(container, 'orderFulfillment').findByOrderId(orderId)).toBeNull()
  })
})
