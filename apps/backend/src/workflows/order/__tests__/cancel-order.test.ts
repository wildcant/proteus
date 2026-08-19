import type { OrderDTO } from '@core/types/order/common.js'
import { Modules } from '@core/utils/index.js'
import { createSimpleWorkflowEngine } from '@core/workflows/simple-adapter.js'
import { setWorkflowEngine } from '@core/workflows/types.js'
import { type Fixtures, test } from '@tests/setup/test-extend.js'
import { asValue, createContainer } from 'awilix'
import { describe, expect, vi } from 'vitest'
import { cancelOrderWorkflow } from '../cancel-order.js'

function setup(generate: Fixtures['dto']['generate'], order?: OrderDTO) {
  const orderFixture = order ?? generate.order()
  const lineItems = [generate.orderLineItem({ orderId: orderFixture.id })]
  const reservations = [generate.reservationItem({ lineItemId: lineItems[0]?.id })]

  const canceledOrder = { ...orderFixture, status: 'canceled' as const, canceledAt: new Date() }

  const orderService = {
    retrieveOrder: vi.fn().mockResolvedValue(orderFixture),
    listOrderLineItems: vi.fn().mockResolvedValue(lineItems),
    cancelOrder: vi.fn().mockResolvedValue(canceledOrder),
  }

  const inventoryService = {
    listReservationItems: vi.fn().mockResolvedValue(reservations),
    deleteReservationItems: vi.fn().mockResolvedValue(undefined),
  }

  const container = createContainer()
  container.register({
    [Modules.ORDER]: asValue(orderService),
    [Modules.INVENTORY]: asValue(inventoryService),
  })

  setWorkflowEngine(createSimpleWorkflowEngine(), container)

  return { order: orderFixture, lineItems, reservations, orderService, inventoryService }
}

describe('cancelOrderWorkflow', () => {
  test('cancels a pending unfulfilled order and deletes reservations', async ({ dto }) => {
    const services = setup(dto.generate)

    const result = await cancelOrderWorkflow.run({ orderId: services.order.id })

    expect(result.status).toBe('canceled')
    expect(result.canceledAt).toBeInstanceOf(Date)

    expect(services.inventoryService.listReservationItems).toHaveBeenCalledWith({
      lineItemId: [services.lineItems[0]?.id],
    })
    expect(services.inventoryService.deleteReservationItems).toHaveBeenCalledWith([services.reservations[0]?.id])
    expect(services.orderService.cancelOrder).toHaveBeenCalledWith(services.order.id)
  })

  test('skips reservation deletion when order has no line items', async ({ dto }) => {
    const services = setup(dto.generate)
    services.orderService.listOrderLineItems.mockResolvedValue([])

    const result = await cancelOrderWorkflow.run({ orderId: services.order.id })

    expect(result.status).toBe('canceled')
    expect(services.inventoryService.listReservationItems).not.toHaveBeenCalled()
    expect(services.inventoryService.deleteReservationItems).not.toHaveBeenCalled()
  })

  test('skips reservation deletion when no reservations exist', async ({ dto }) => {
    const services = setup(dto.generate)
    services.inventoryService.listReservationItems.mockResolvedValue([])

    const result = await cancelOrderWorkflow.run({ orderId: services.order.id })

    expect(result.status).toBe('canceled')
    expect(services.inventoryService.deleteReservationItems).not.toHaveBeenCalled()
  })

  test('rejects when order status is not pending', async ({ dto }) => {
    const services = setup(dto.generate, dto.generate.order({ status: 'completed' }))

    await expect(cancelOrderWorkflow.run({ orderId: services.order.id })).rejects.toThrow(
      'status is "completed", expected "pending"',
    )
  })

  test('rejects when order is already fulfilled', async ({ dto }) => {
    const services = setup(dto.generate, dto.generate.order({ fulfillmentStatus: 'fulfilled' }))

    await expect(cancelOrderWorkflow.run({ orderId: services.order.id })).rejects.toThrow(
      'fulfillment status is "fulfilled", expected "unfulfilled"',
    )
  })
})
