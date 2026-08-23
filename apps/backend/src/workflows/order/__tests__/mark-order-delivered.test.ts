import type { IOrderModuleService } from '@core/types/order/service.js'
import { Modules } from '@core/utils/index.js'
import type { TestContainer } from '@tests/setup/create-container.js'
import { type Fixtures, test } from '@tests/setup/test-extend.js'
import { vi } from 'vitest'
import { markOrderDeliveredWorkflow } from '../mark-order-delivered.js'

type Services = Fixtures['service']

let container: TestContainer

test.beforeEach(async ({ createTestContainer }) => {
  container = await createTestContainer()
})

/** Inventory is left untracked: delivery does not touch stock. */
const shippedOrder = async (service: Services) => {
  const { order } = await service.create.order(container, { inventory: null })
  const { fulfillmentId } = await service.create.shippedOrder(container, order.id)

  return { orderId: order.id, fulfillmentId }
}

test.describe('markOrderDeliveredWorkflow', () => {
  test('stamps the fulfillment as delivered and advances the order', async ({ service, expect }) => {
    const { orderId, fulfillmentId } = await shippedOrder(service)

    const result = await markOrderDeliveredWorkflow.run({ orderId, fulfillmentId })

    expect(result.fulfillmentStatus).toBe('delivered')
    expect(await service.read.order(container, orderId)).toMatchObject({ fulfillmentStatus: 'delivered' })
    expect(await service.read.fulfillment(container, fulfillmentId)).toMatchObject({
      deliveredAt: expect.any(Date),
    })
  })

  test('refuses to deliver a canceled order', async ({ service, expect }) => {
    const { orderId, fulfillmentId } = await shippedOrder(service)
    // Written directly: `cancel-order` refuses an order that has already shipped, so this
    // combination is only reachable by an admin correcting the record.
    await service.update.order(container, orderId, { status: 'canceled' })

    await expect(markOrderDeliveredWorkflow.run({ orderId, fulfillmentId })).rejects.toThrow('order is canceled')
  })

  test('refuses to deliver a canceled fulfillment', async ({ service, expect }) => {
    const { orderId, fulfillmentId } = await shippedOrder(service)
    await service.update.fulfillment(container, fulfillmentId, { canceledAt: new Date() })

    await expect(markOrderDeliveredWorkflow.run({ orderId, fulfillmentId })).rejects.toThrow('fulfillment is canceled')
  })

  test('refuses to deliver an order that has not shipped', async ({ service, expect }) => {
    const { order } = await service.create.order(container, { inventory: null })
    const { fulfillmentId } = await service.create.fulfilledOrder(container, order.id)

    await expect(markOrderDeliveredWorkflow.run({ orderId: order.id, fulfillmentId })).rejects.toThrow(
      'fulfillment status is "fulfilled", expected "shipped"',
    )
  })

  test('refuses a fulfillment belonging to another order', async ({ service, expect }) => {
    const { orderId } = await shippedOrder(service)
    const other = await shippedOrder(service)

    await expect(markOrderDeliveredWorkflow.run({ orderId, fulfillmentId: other.fulfillmentId })).rejects.toThrow(
      `is not linked to order ${orderId}`,
    )
  })

  test('rollback un-stamps the fulfillment when the order cannot be advanced', async ({ service, expect }) => {
    const { orderId, fulfillmentId } = await shippedOrder(service)

    vi.spyOn(container.resolve<IOrderModuleService>(Modules.ORDER), 'updateFulfillmentStatus').mockRejectedValueOnce(
      new Error('DB error'),
    )

    await expect(markOrderDeliveredWorkflow.run({ orderId, fulfillmentId })).rejects.toThrow('DB error')

    expect(await service.read.fulfillment(container, fulfillmentId)).toMatchObject({ deliveredAt: null })
    expect(await service.read.order(container, orderId)).toMatchObject({ fulfillmentStatus: 'shipped' })
  })
})
