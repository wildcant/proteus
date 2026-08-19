import type { OrderDTO } from '@core/types/order/common.js'
import { ContainerRegistrationKeys, Modules } from '@core/utils/index.js'
import { createSimpleWorkflowEngine } from '@core/workflows/simple-adapter.js'
import { setWorkflowEngine } from '@core/workflows/types.js'
import { type Fixtures, test } from '@tests/setup/test-extend.js'
import { asValue, createContainer } from 'awilix'
import { describe, expect, vi } from 'vitest'
import { createOrderFulfillmentWorkflow } from '../create-order-fulfillment.js'

function setup(generate: Fixtures['dto']['generate'], orderOverrides?: Partial<OrderDTO>) {
  const order = generate.order(orderOverrides)
  const fulfillment = generate.fulfillment()
  const lineItems = [generate.orderLineItem({ orderId: order.id })]
  const reservations = [
    generate.reservationItem({
      lineItemId: lineItems[0]?.id,
      inventoryItemId: 'iitem_abc',
      locationId: 'sloc_abc',
      quantity: 2,
    }),
  ]
  const updatedOrder = { ...order, fulfillmentStatus: 'fulfilled' as const }

  const orderService = {
    retrieveOrder: vi.fn().mockResolvedValue(order),
    updateFulfillmentStatus: vi.fn().mockResolvedValue(updatedOrder),
    listOrderLineItems: vi.fn().mockResolvedValue(lineItems),
  }

  const fulfillmentService = {
    createFulfillment: vi.fn().mockResolvedValue(fulfillment),
    cancelFulfillment: vi.fn().mockResolvedValue(undefined),
  }

  const orderFulfillmentRepo = {
    create: vi.fn().mockResolvedValue({ id: 'ordful_1', orderId: order.id, fulfillmentId: fulfillment.id }),
  }

  const linkService = {
    repo: vi.fn().mockReturnValue(orderFulfillmentRepo),
    dismissLinks: vi.fn().mockResolvedValue({}),
  }

  const inventoryService = {
    adjustInventoryLevel: vi.fn().mockResolvedValue(undefined),
    listReservationItems: vi.fn().mockResolvedValue(reservations),
    deleteReservationItems: vi.fn().mockResolvedValue(undefined),
  }

  const container = createContainer()
  container.register({
    [Modules.ORDER]: asValue(orderService),
    [Modules.FULFILLMENT]: asValue(fulfillmentService),
    [Modules.INVENTORY]: asValue(inventoryService),
    [ContainerRegistrationKeys.LINK]: asValue(linkService),
  })

  setWorkflowEngine(createSimpleWorkflowEngine(), container)

  const fulfillmentData = {
    providerId: 'manual',
    items: [{ title: 'Test', quantity: 1 }],
    address: { firstName: 'John', lastName: 'Doe' },
  }

  return {
    order,
    fulfillment,
    lineItems,
    reservations,
    orderService,
    fulfillmentService,
    linkService,
    orderFulfillmentRepo,
    inventoryService,
    fulfillmentData,
  }
}

describe('createOrderFulfillmentWorkflow', () => {
  test('creates fulfillment, links it, updates status, and adjusts inventory', async ({ dto }) => {
    const services = setup(dto.generate)

    const result = await createOrderFulfillmentWorkflow.run({
      orderId: services.order.id,
      locationId: 'sloc_abc',
      fulfillmentData: services.fulfillmentData,
    })

    expect(result.fulfillmentStatus).toBe('fulfilled')
    expect(services.fulfillmentService.createFulfillment).toHaveBeenCalledWith(services.fulfillmentData)
    expect(services.orderFulfillmentRepo.create).toHaveBeenCalledWith({
      orderId: services.order.id,
      fulfillmentId: services.fulfillment.id,
    })
    expect(services.orderService.updateFulfillmentStatus).toHaveBeenCalledWith(services.order.id, 'fulfilled')
    expect(services.inventoryService.adjustInventoryLevel).toHaveBeenCalledWith('iitem_abc', 'sloc_abc', -2)
    expect(services.inventoryService.deleteReservationItems).toHaveBeenCalledWith([services.reservations[0]?.id])
  })

  test('rejects when order status is not pending', async ({ dto }) => {
    setup(dto.generate, { status: 'completed' })

    await expect(
      createOrderFulfillmentWorkflow.run({
        orderId: 'any',
        locationId: 'sloc_1',
        fulfillmentData: { providerId: 'manual', items: [{ title: 'X', quantity: 1 }], address: {} },
      }),
    ).rejects.toThrow('status is "completed", expected "pending"')
  })

  test('rejects when fulfillment status is not unfulfilled', async ({ dto }) => {
    setup(dto.generate, { fulfillmentStatus: 'fulfilled' })

    await expect(
      createOrderFulfillmentWorkflow.run({
        orderId: 'any',
        locationId: 'sloc_1',
        fulfillmentData: { providerId: 'manual', items: [{ title: 'X', quantity: 1 }], address: {} },
      }),
    ).rejects.toThrow('fulfillment status is "fulfilled", expected "unfulfilled"')
  })

  test('compensates on failure after fulfillment is created', async ({ dto }) => {
    const services = setup(dto.generate)
    services.orderService.updateFulfillmentStatus.mockRejectedValue(new Error('DB error'))

    await expect(
      createOrderFulfillmentWorkflow.run({
        orderId: services.order.id,
        locationId: 'sloc_abc',
        fulfillmentData: services.fulfillmentData,
      }),
    ).rejects.toThrow('DB error')

    expect(services.linkService.dismissLinks).toHaveBeenCalledWith({ fulfillmentId: [services.fulfillment.id] })
    expect(services.fulfillmentService.cancelFulfillment).toHaveBeenCalledWith(services.fulfillment.id)
  })

  test('skips inventory adjustment when no line items exist', async ({ dto }) => {
    const services = setup(dto.generate)
    services.orderService.listOrderLineItems.mockResolvedValue([])

    await createOrderFulfillmentWorkflow.run({
      orderId: services.order.id,
      locationId: 'sloc_abc',
      fulfillmentData: services.fulfillmentData,
    })

    expect(services.inventoryService.adjustInventoryLevel).not.toHaveBeenCalled()
    expect(services.inventoryService.deleteReservationItems).not.toHaveBeenCalled()
  })
})
