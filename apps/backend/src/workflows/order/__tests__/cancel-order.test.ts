import { BigNumber } from '@core/db/bignum.js'
import type { OrderDTO } from '@core/types/order/common.js'
import type { PaymentCollectionDTO } from '@core/types/payment/common.js'
import { ContainerRegistrationKeys, Modules } from '@core/utils/index.js'
import { createSimpleWorkflowEngine } from '@core/workflows/simple-adapter.js'
import { setWorkflowEngine } from '@core/workflows/types.js'
import { type Fixtures, test } from '@tests/setup/test-extend.js'
import { asValue, createContainer } from 'awilix'
import { vi } from 'vitest'
import { cancelOrderWorkflow } from '../cancel-order.js'

function setup(
  generate: Fixtures['dto']['generate'],
  overrides?: { order?: OrderDTO; collection?: PaymentCollectionDTO },
) {
  const order = overrides?.order ?? generate.order()
  const lineItems = [generate.orderLineItem({ orderId: order.id })]
  const reservations = [generate.reservationItem({ lineItemId: lineItems[0]?.id })]
  const canceledOrder = { ...order, status: 'canceled' as const, canceledAt: new Date() }

  const collection: PaymentCollectionDTO = overrides?.collection ?? {
    id: 'paycol_test',
    currencyCode: 'usd',
    amount: new BigNumber(10000),
    authorizedAmount: new BigNumber(10000),
    capturedAmount: null,
    refundedAmount: null,
    completedAt: null,
    status: 'authorized',
    metadata: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
    payments: [generate.payment({ canceledAt: null, captures: [] })],
    paymentSessions: [],
  }

  const orderService = {
    listOrderLineItems: vi.fn().mockResolvedValue(lineItems),
    cancelOrder: vi.fn().mockImplementation(() => {
      if (order.status !== 'pending') {
        return Promise.reject(
          new Error(`Cannot cancel order ${order.id}: status is "${order.status}", expected "pending"`),
        )
      }
      if (order.fulfillmentStatus !== 'unfulfilled') {
        return Promise.reject(
          new Error(
            `Cannot cancel order ${order.id}: fulfillment status is "${order.fulfillmentStatus}", expected "unfulfilled"`,
          ),
        )
      }
      return Promise.resolve(canceledOrder)
    }),
    updateOrder: vi.fn().mockResolvedValue(order),
  }

  const inventoryService = {
    listReservationItems: vi.fn().mockResolvedValue(reservations),
    softDeleteReservationItems: vi.fn().mockResolvedValue(undefined),
    restoreReservationItems: vi.fn().mockResolvedValue(undefined),
  }

  const paymentService = {
    retrievePaymentCollection: vi.fn().mockResolvedValue(collection),
    cancelPayment: vi.fn().mockResolvedValue(undefined),
    refundPayment: vi.fn().mockResolvedValue(undefined),
  }

  const orderPaymentCollectionRepo = {
    findByOrderId: vi.fn().mockResolvedValue({ orderId: order.id, paymentCollectionId: collection.id }),
  }

  const linkService = {
    repo: vi.fn().mockReturnValue(orderPaymentCollectionRepo),
  }

  const container = createContainer()
  container.register({
    [Modules.ORDER]: asValue(orderService),
    [Modules.INVENTORY]: asValue(inventoryService),
    [Modules.PAYMENT]: asValue(paymentService),
    [ContainerRegistrationKeys.LINK]: asValue(linkService),
  })

  setWorkflowEngine(createSimpleWorkflowEngine(), container)

  return {
    order,
    lineItems,
    reservations,
    collection,
    orderService,
    inventoryService,
    paymentService,
    linkService,
    orderPaymentCollectionRepo,
  }
}

test.describe('cancelOrderWorkflow', () => {
  test('cancels a pending unfulfilled order, cancels uncaptured payments, and deletes reservations', async ({
    dto,
    expect,
  }) => {
    const services = setup(dto.generate)

    const result = await cancelOrderWorkflow.run({ orderId: services.order.id })

    expect(result.status).toBe('canceled')
    expect(result.canceledAt).toBeInstanceOf(Date)

    expect(services.paymentService.cancelPayment).toHaveBeenCalledWith(services.collection.payments?.[0]?.id)
    expect(services.paymentService.refundPayment).not.toHaveBeenCalled()

    expect(services.inventoryService.listReservationItems).toHaveBeenCalledWith({
      lineItemId: [services.lineItems[0]?.id],
    })
    expect(services.inventoryService.softDeleteReservationItems).toHaveBeenCalledWith([services.reservations[0]?.id])
    expect(services.orderService.cancelOrder).toHaveBeenCalledWith(services.order.id)
  })

  test('refunds captured payments instead of canceling them', async ({ dto, expect }) => {
    const payment = dto.generate.payment({
      canceledAt: null,
      capturedAt: new Date(),
      captures: [
        {
          id: 'cap_1',
          paymentId: 'pay_1',
          amount: new BigNumber(10000),
          createdBy: null,
          metadata: null,
          createdAt: new Date(),
        },
      ],
    })
    const collection: PaymentCollectionDTO = {
      id: 'paycol_test',
      currencyCode: 'usd',
      amount: new BigNumber(10000),
      authorizedAmount: new BigNumber(10000),
      capturedAmount: new BigNumber(10000),
      refundedAmount: null,
      completedAt: new Date(),
      status: 'completed',
      metadata: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null,
      payments: [payment],
      paymentSessions: [],
    }

    const services = setup(dto.generate, { collection })

    await cancelOrderWorkflow.run({ orderId: services.order.id })

    expect(services.paymentService.refundPayment).toHaveBeenCalledWith({ paymentId: payment.id })
    expect(services.paymentService.cancelPayment).not.toHaveBeenCalled()
  })

  test('skips already-canceled payments', async ({ dto, expect }) => {
    const collection: PaymentCollectionDTO = {
      id: 'paycol_test',
      currencyCode: 'usd',
      amount: new BigNumber(10000),
      authorizedAmount: null,
      capturedAmount: null,
      refundedAmount: null,
      completedAt: null,
      status: 'not_paid',
      metadata: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null,
      payments: [dto.generate.payment({ canceledAt: new Date() })],
      paymentSessions: [],
    }

    const services = setup(dto.generate, { collection })

    await cancelOrderWorkflow.run({ orderId: services.order.id })

    expect(services.paymentService.cancelPayment).not.toHaveBeenCalled()
    expect(services.paymentService.refundPayment).not.toHaveBeenCalled()
  })

  test('skips payment step when order has no payment collection', async ({ dto, expect }) => {
    const services = setup(dto.generate)
    services.orderPaymentCollectionRepo.findByOrderId.mockResolvedValue(null)

    await cancelOrderWorkflow.run({ orderId: services.order.id })

    expect(services.paymentService.retrievePaymentCollection).not.toHaveBeenCalled()
    expect(services.orderService.cancelOrder).toHaveBeenCalledWith(services.order.id)
  })

  test('skips reservation deletion when order has no line items', async ({ dto, expect }) => {
    const services = setup(dto.generate)
    services.orderService.listOrderLineItems.mockResolvedValue([])

    const result = await cancelOrderWorkflow.run({ orderId: services.order.id })

    expect(result.status).toBe('canceled')
    expect(services.inventoryService.listReservationItems).not.toHaveBeenCalled()
    expect(services.inventoryService.softDeleteReservationItems).not.toHaveBeenCalled()
  })

  test('skips reservation deletion when no reservations exist', async ({ dto, expect }) => {
    const services = setup(dto.generate)
    services.inventoryService.listReservationItems.mockResolvedValue([])

    const result = await cancelOrderWorkflow.run({ orderId: services.order.id })

    expect(result.status).toBe('canceled')
    expect(services.inventoryService.softDeleteReservationItems).not.toHaveBeenCalled()
  })

  test('compensation: restores order and reservations when cancel-payments fails', async ({ dto, expect }) => {
    const services = setup(dto.generate)
    services.paymentService.cancelPayment.mockRejectedValue(new Error('provider unavailable'))

    await expect(cancelOrderWorkflow.run({ orderId: services.order.id })).rejects.toThrow('provider unavailable')

    expect(services.orderService.updateOrder).toHaveBeenCalledWith(services.order.id, {
      status: 'pending',
      canceledAt: null,
    })
    expect(services.inventoryService.restoreReservationItems).toHaveBeenCalledWith([services.reservations[0]?.id])
  })

  test('compensation: restores order when delete-reservations fails', async ({ dto, expect }) => {
    const services = setup(dto.generate)
    services.inventoryService.softDeleteReservationItems.mockRejectedValue(new Error('inventory unavailable'))

    await expect(cancelOrderWorkflow.run({ orderId: services.order.id })).rejects.toThrow('inventory unavailable')

    expect(services.orderService.updateOrder).toHaveBeenCalledWith(services.order.id, {
      status: 'pending',
      canceledAt: null,
    })
    expect(services.inventoryService.restoreReservationItems).not.toHaveBeenCalled()
    expect(services.paymentService.cancelPayment).not.toHaveBeenCalled()
  })

  test('rejects when order status is not pending', async ({ dto, expect }) => {
    const services = setup(dto.generate, { order: dto.generate.order({ status: 'completed' }) })

    await expect(cancelOrderWorkflow.run({ orderId: services.order.id })).rejects.toThrow(
      'status is "completed", expected "pending"',
    )
  })

  test('rejects when order is already fulfilled', async ({ dto, expect }) => {
    const services = setup(dto.generate, { order: dto.generate.order({ fulfillmentStatus: 'fulfilled' }) })

    await expect(cancelOrderWorkflow.run({ orderId: services.order.id })).rejects.toThrow(
      'fulfillment status is "fulfilled", expected "unfulfilled"',
    )
  })
})
