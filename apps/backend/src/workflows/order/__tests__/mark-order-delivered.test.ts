import type { OrderDTO } from '@core/types/order/common.js'
import { ContainerRegistrationKeys, Modules } from '@core/utils/index.js'
import { createSimpleWorkflowEngine } from '@core/workflows/simple-adapter.js'
import { setWorkflowEngine } from '@core/workflows/types.js'
import { type Fixtures, test } from '@tests/setup/test-extend.js'
import { asValue, createContainer } from 'awilix'
import { describe, expect, vi } from 'vitest'
import { markOrderDeliveredWorkflow } from '../mark-order-delivered.js'

function setup(generate: Fixtures['dto']['generate'], orderOverrides?: Partial<OrderDTO>) {
  const order = generate.order({ status: 'pending', fulfillmentStatus: 'shipped', ...orderOverrides })
  const fulfillment = generate.fulfillment({ shippedAt: new Date() })
  const deliveredOrder = { ...order, fulfillmentStatus: 'delivered' as const }

  const orderService = {
    retrieveOrder: vi.fn().mockResolvedValue(order),
    updateFulfillmentStatus: vi.fn().mockResolvedValue(deliveredOrder),
  }

  const fulfillmentService = {
    retrieveFulfillment: vi.fn().mockResolvedValue(fulfillment),
    updateFulfillment: vi.fn().mockResolvedValue({ ...fulfillment, deliveredAt: new Date() }),
  }

  const orderFulfillmentLink = {
    orderId: order.id,
    fulfillmentId: fulfillment.id,
  }

  const orderFulfillmentRepo = {
    findByFulfillmentId: vi.fn().mockResolvedValue(orderFulfillmentLink),
  }

  const linkService = {
    repo: vi.fn().mockReturnValue(orderFulfillmentRepo),
  }

  const container = createContainer()
  container.register({
    [Modules.ORDER]: asValue(orderService),
    [Modules.FULFILLMENT]: asValue(fulfillmentService),
    [ContainerRegistrationKeys.LINK]: asValue(linkService),
  })

  setWorkflowEngine(createSimpleWorkflowEngine(), container)

  return { order, fulfillment, orderService, fulfillmentService, linkService, orderFulfillmentRepo }
}

describe('markOrderDeliveredWorkflow', () => {
  test('marks fulfillment as delivered and updates order status', async ({ dto }) => {
    const services = setup(dto.generate)

    const result = await markOrderDeliveredWorkflow.run({
      orderId: services.order.id,
      fulfillmentId: services.fulfillment.id,
    })

    expect(result.fulfillmentStatus).toBe('delivered')
    expect(services.fulfillmentService.updateFulfillment).toHaveBeenCalledWith(services.fulfillment.id, {
      deliveredAt: expect.any(Date),
    })
    expect(services.orderService.updateFulfillmentStatus).toHaveBeenCalledWith(services.order.id, 'delivered')
  })

  test('rejects when order is canceled', async ({ dto }) => {
    const services = setup(dto.generate, { status: 'canceled', fulfillmentStatus: 'shipped' })

    await expect(
      markOrderDeliveredWorkflow.run({
        orderId: services.order.id,
        fulfillmentId: services.fulfillment.id,
      }),
    ).rejects.toThrow('order is canceled')
  })

  test('rejects when fulfillment is canceled', async ({ dto }) => {
    const services = setup(dto.generate)
    services.fulfillmentService.retrieveFulfillment.mockResolvedValue({
      ...services.fulfillment,
      canceledAt: new Date(),
    })

    await expect(
      markOrderDeliveredWorkflow.run({
        orderId: services.order.id,
        fulfillmentId: services.fulfillment.id,
      }),
    ).rejects.toThrow('fulfillment is canceled')
  })

  test('rejects when fulfillment status is not shipped', async ({ dto }) => {
    setup(dto.generate, { fulfillmentStatus: 'fulfilled' })

    await expect(markOrderDeliveredWorkflow.run({ orderId: 'any', fulfillmentId: 'ful_1' })).rejects.toThrow(
      'fulfillment status is "fulfilled", expected "shipped"',
    )
  })

  test('rejects when fulfillment is not linked to the order', async ({ dto }) => {
    const services = setup(dto.generate)
    services.orderFulfillmentRepo.findByFulfillmentId.mockResolvedValue(null)

    await expect(
      markOrderDeliveredWorkflow.run({
        orderId: services.order.id,
        fulfillmentId: 'ful_unlinked',
      }),
    ).rejects.toThrow('not linked to order')
  })

  test('compensates on failure by reverting fulfillment and order status', async ({ dto }) => {
    const services = setup(dto.generate)
    services.orderService.updateFulfillmentStatus.mockRejectedValue(new Error('DB error'))

    await expect(
      markOrderDeliveredWorkflow.run({
        orderId: services.order.id,
        fulfillmentId: services.fulfillment.id,
      }),
    ).rejects.toThrow('DB error')

    expect(services.fulfillmentService.updateFulfillment).toHaveBeenLastCalledWith(services.fulfillment.id, {
      deliveredAt: null,
    })
  })
})
