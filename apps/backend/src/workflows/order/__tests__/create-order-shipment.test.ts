import type { IOrderModuleService } from '@core/types/order/service.js'
import { Modules } from '@core/utils/index.js'
import type { TestContainer } from '@tests/setup/create-container.js'
import { type Fixtures, test } from '@tests/setup/test-extend.js'
import { vi } from 'vitest'
import { createOrderShipmentWorkflow } from '../create-order-shipment.js'

type Services = Fixtures['service']

let container: TestContainer

test.beforeEach(async ({ createTestContainer }) => {
  container = await createTestContainer()
})

/** Inventory is left untracked: shipping does not touch stock, and tracking it would only
 *  couple these tests to the reservation path `create-order-fulfillment` owns. */
const fulfilledOrder = async (service: Services) => {
  const { order } = await service.create.order(container, { inventory: null })
  const { fulfillmentId } = await service.create.fulfilledOrder(container, order.id)

  return { orderId: order.id, fulfillmentId }
}

test.describe('createOrderShipmentWorkflow', () => {
  test('stamps the fulfillment as shipped and advances the order', async ({ service, expect }) => {
    const { orderId, fulfillmentId } = await fulfilledOrder(service)

    const result = await createOrderShipmentWorkflow.run({ orderId, fulfillmentId })

    expect(result.fulfillmentStatus).toBe('shipped')
    expect(await service.read.order(container, orderId)).toMatchObject({ fulfillmentStatus: 'shipped' })
    expect(await service.read.fulfillment(container, fulfillmentId)).toMatchObject({
      shippedAt: expect.any(Date),
    })
  })

  test('records tracking details when they are given', async ({ service, expect }) => {
    const { orderId, fulfillmentId } = await fulfilledOrder(service)

    await createOrderShipmentWorkflow.run({
      orderId,
      fulfillmentId,
      trackingNumber: 'TRACK123',
      trackingUrl: 'https://track.example.com/TRACK123',
      labelUrl: 'https://labels.example.com/TRACK123.pdf',
    })

    expect(await service.read.fulfillment(container, fulfillmentId)).toMatchObject({
      data: {
        trackingNumber: 'TRACK123',
        trackingUrl: 'https://track.example.com/TRACK123',
        labelUrl: 'https://labels.example.com/TRACK123.pdf',
      },
    })
  })

  test('refuses to ship an order that was never fulfilled', async ({ service, expect }) => {
    const { order } = await service.create.order(container, { inventory: null })

    // The status guard runs before the link lookup, so the fulfillment id never gets resolved.
    await expect(
      createOrderShipmentWorkflow.run({ orderId: order.id, fulfillmentId: 'ful_never_created' }),
    ).rejects.toThrow('fulfillment status is "unfulfilled", expected "fulfilled"')
  })

  test('refuses a fulfillment belonging to another order', async ({ service, expect }) => {
    const { orderId } = await fulfilledOrder(service)
    const other = await fulfilledOrder(service)

    await expect(createOrderShipmentWorkflow.run({ orderId, fulfillmentId: other.fulfillmentId })).rejects.toThrow(
      `is not linked to order ${orderId}`,
    )
  })

  test('rollback un-stamps the fulfillment when the order cannot be advanced', async ({ service, expect }) => {
    const { orderId, fulfillmentId } = await fulfilledOrder(service)

    vi.spyOn(container.resolve<IOrderModuleService>(Modules.ORDER), 'updateFulfillmentStatus').mockRejectedValueOnce(
      new Error('DB error'),
    )

    await expect(createOrderShipmentWorkflow.run({ orderId, fulfillmentId })).rejects.toThrow('DB error')

    expect(await service.read.fulfillment(container, fulfillmentId)).toMatchObject({ shippedAt: null })
    expect(await service.read.order(container, orderId)).toMatchObject({ fulfillmentStatus: 'fulfilled' })
  })
})
