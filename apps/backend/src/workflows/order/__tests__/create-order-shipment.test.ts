import type { OrderDTO } from '@core/types/order/common.js'
import { ContainerRegistrationKeys, Modules } from '@core/utils/index.js'
import { createSimpleWorkflowEngine } from '@core/workflows/simple-adapter.js'
import { setWorkflowEngine } from '@core/workflows/types.js'
import { type Fixtures, test } from '@tests/setup/test-extend.js'
import { asValue, createContainer } from 'awilix'
import { describe, expect, vi } from 'vitest'
import { createOrderShipmentWorkflow } from '../create-order-shipment.js'

function setup(generate: Fixtures['dto']['generate'], orderOverrides?: Partial<OrderDTO>) {
  const order = generate.order({ status: 'pending', fulfillmentStatus: 'fulfilled', ...orderOverrides })
  const fulfillment = generate.fulfillment()
  const shippedOrder = { ...order, fulfillmentStatus: 'shipped' as const }

  const orderService = {
    retrieveOrder: vi.fn().mockResolvedValue(order),
    updateFulfillmentStatus: vi.fn().mockResolvedValue(shippedOrder),
  }

  const fulfillmentService = {
    updateFulfillment: vi.fn().mockResolvedValue({ ...fulfillment, shippedAt: new Date() }),
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

describe('createOrderShipmentWorkflow', () => {
  test('marks fulfillment as shipped and updates order status', async ({ dto }) => {
    const services = setup(dto.generate)

    const result = await createOrderShipmentWorkflow.run({
      orderId: services.order.id,
      fulfillmentId: services.fulfillment.id,
    })

    expect(result.fulfillmentStatus).toBe('shipped')
    expect(services.fulfillmentService.updateFulfillment).toHaveBeenCalledWith(services.fulfillment.id, {
      shippedAt: expect.any(Date),
    })
    expect(services.orderService.updateFulfillmentStatus).toHaveBeenCalledWith(services.order.id, 'shipped')
  })

  test('passes tracking data when provided', async ({ dto }) => {
    const services = setup(dto.generate)

    await createOrderShipmentWorkflow.run({
      orderId: services.order.id,
      fulfillmentId: services.fulfillment.id,
      trackingNumber: 'TRACK123',
      trackingUrl: 'https://track.example.com/TRACK123',
      labelUrl: 'https://labels.example.com/TRACK123.pdf',
    })

    expect(services.fulfillmentService.updateFulfillment).toHaveBeenCalledWith(services.fulfillment.id, {
      shippedAt: expect.any(Date),
      data: {
        trackingNumber: 'TRACK123',
        trackingUrl: 'https://track.example.com/TRACK123',
        labelUrl: 'https://labels.example.com/TRACK123.pdf',
      },
    })
  })

  test('rejects when fulfillment status is not fulfilled', async ({ dto }) => {
    setup(dto.generate, { fulfillmentStatus: 'unfulfilled' })

    await expect(createOrderShipmentWorkflow.run({ orderId: 'any', fulfillmentId: 'ful_1' })).rejects.toThrow(
      'fulfillment status is "unfulfilled", expected "fulfilled"',
    )
  })

  test('rejects when fulfillment is not linked to the order', async ({ dto }) => {
    const services = setup(dto.generate)
    services.orderFulfillmentRepo.findByFulfillmentId.mockResolvedValue(null)

    await expect(
      createOrderShipmentWorkflow.run({
        orderId: services.order.id,
        fulfillmentId: 'ful_unlinked',
      }),
    ).rejects.toThrow('not linked to order')
  })

  test('compensates on failure by reverting fulfillment and order status', async ({ dto }) => {
    const services = setup(dto.generate)
    services.orderService.updateFulfillmentStatus.mockRejectedValue(new Error('DB error'))

    await expect(
      createOrderShipmentWorkflow.run({
        orderId: services.order.id,
        fulfillmentId: services.fulfillment.id,
      }),
    ).rejects.toThrow('DB error')

    expect(services.fulfillmentService.updateFulfillment).toHaveBeenLastCalledWith(services.fulfillment.id, {
      shippedAt: null,
      data: null,
    })
  })
})
