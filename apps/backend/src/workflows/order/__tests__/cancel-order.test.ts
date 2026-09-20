import type { IInventoryModuleService } from '@core/types/inventory/service.js'
import type { IPaymentModuleService } from '@core/types/payment/service.js'
import { Modules } from '@core/utils/modules-definition.js'
import type { TestContainer } from '@tests/setup/create-container.js'
import { type Fixtures, test } from '@tests/setup/test-extend.js'
import { assertDefined } from '@tests/utils/assert-defined.js'
import { vi } from 'vitest'
import { cancelOrderWorkflow } from '../cancel-order.js'

type Services = Fixtures['service']

let container: TestContainer

test.beforeEach(async ({ createTestContainer }) => {
  container = await createTestContainer()
})

/**
 * An order in the state cancellation finds one in: placed through checkout, so its stock is
 * committed to it and its payment is authorized and not yet taken.
 *
 * The level holds exactly what the order takes, which is what makes "the units came back" an
 * assertion about a number rather than about a delta.
 */
async function placedOrder(service: Services) {
  const checkout = await service.create.order(container)
  assertDefined(checkout.inventoryItem)
  assertDefined(checkout.paymentCollection)

  const [lineItem] = await service.read.orderLineItems(container, checkout.order.id)
  assertDefined(lineItem)

  return {
    orderId: checkout.order.id,
    inventoryItemId: checkout.inventoryItem.id,
    paymentCollectionId: checkout.paymentCollection.id,
    lineItem,
  }
}

/** The payment checkout authorized, which is the row cancellation has to act on. */
async function authorizedPayment(service: Services, paymentCollectionId: string) {
  const collection = await service.read.paymentCollection(container, paymentCollectionId)
  const payment = collection.payments?.[0]
  assertDefined(payment)

  return payment
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

test.describe('cancelOrderWorkflow', () => {
  test('cancels the order and puts the units it was holding back on the shelf', async ({ service, expect }) => {
    const { orderId, inventoryItemId, lineItem } = await placedOrder(service)

    // Everything the shop had is committed to this order, so a shopper sees none of it.
    expect(await stockOf(service, inventoryItemId)).toEqual({
      stockedQuantity: lineItem.quantity,
      reservedQuantity: lineItem.quantity,
      availableQuantity: 0,
    })

    const canceled = await cancelOrderWorkflow.run({ orderId })

    expect(canceled.status).toBe('canceled')
    expect(canceled.canceledAt).toBeInstanceOf(Date)
    expect(await service.read.order(container, orderId)).toMatchObject({ status: 'canceled' })

    // Nothing left the warehouse, so stocked is untouched and the whole of it is sellable again.
    expect(await stockOf(service, inventoryItemId)).toEqual({
      stockedQuantity: lineItem.quantity,
      reservedQuantity: 0,
      availableQuantity: lineItem.quantity,
    })
    expect(await service.read.reservationItems(container, { lineItemId: lineItem.id })).toEqual([])
  })

  test('releases the reservations of that order and no others', async ({ service, expect }) => {
    const canceled = await placedOrder(service)
    const untouched = await placedOrder(service)

    await cancelOrderWorkflow.run({ orderId: canceled.orderId })

    expect(await stockOf(service, untouched.inventoryItemId)).toMatchObject({
      reservedQuantity: untouched.lineItem.quantity,
      availableQuantity: 0,
    })
    expect(await service.read.reservationItems(container, { lineItemId: untouched.lineItem.id })).toHaveLength(1)
  })

  test('voids an authorized payment rather than refunding it', async ({ service, expect }) => {
    const { orderId, paymentCollectionId } = await placedOrder(service)
    const payment = await authorizedPayment(service, paymentCollectionId)

    await cancelOrderWorkflow.run({ orderId })

    const afterwards = await service.read.payment(container, payment.id)
    expect(afterwards.canceledAt).toBeInstanceOf(Date)
    // Nothing was ever taken, so there is nothing to give back — a refund here would move money
    // out of the merchant's account against a capture that never happened.
    expect(afterwards.refunds ?? []).toEqual([])
  })

  test('refunds a captured payment rather than voiding it', async ({ service, expect }) => {
    const { orderId, paymentCollectionId } = await placedOrder(service)
    const payment = await authorizedPayment(service, paymentCollectionId)
    await service.create.capturedPayment(container, payment.id)

    await cancelOrderWorkflow.run({ orderId })

    const afterwards = await service.read.payment(container, payment.id)
    expect(afterwards.canceledAt).toBeNull()
    expect(afterwards.refunds?.map((refund) => refund.amount.toFixed())).toEqual([payment.amount.toFixed()])
  })

  test('rollback re-commits the stock and un-cancels the order when the payment cannot be voided', async ({
    service,
    expect,
  }) => {
    const { orderId, inventoryItemId, lineItem } = await placedOrder(service)

    vi.spyOn(container.resolve<IPaymentModuleService>(Modules.PAYMENT), 'cancelPayment').mockRejectedValueOnce(
      new Error('provider unavailable'),
    )

    await expect(cancelOrderWorkflow.run({ orderId })).rejects.toThrow('provider unavailable')

    expect(await service.read.order(container, orderId)).toMatchObject({ status: 'pending', canceledAt: null })
    // The half-cancellation that would otherwise be left behind. The order is live again, so the
    // units it sold have to be spoken for again: restoring the reservation row without the counter
    // would leave the shop offering stock an open order is already holding.
    expect(await stockOf(service, inventoryItemId)).toEqual({
      stockedQuantity: lineItem.quantity,
      reservedQuantity: lineItem.quantity,
      availableQuantity: 0,
    })
    expect(await service.read.reservationItems(container, { lineItemId: lineItem.id })).toHaveLength(1)
  })

  test('rollback un-cancels the order and leaves the payment standing when the release fails', async ({
    service,
    expect,
  }) => {
    const { orderId, inventoryItemId, lineItem, paymentCollectionId } = await placedOrder(service)
    const payment = await authorizedPayment(service, paymentCollectionId)

    vi.spyOn(
      container.resolve<IInventoryModuleService>(Modules.INVENTORY),
      'softDeleteReservationItems',
    ).mockRejectedValueOnce(new Error('inventory unavailable'))

    await expect(cancelOrderWorkflow.run({ orderId })).rejects.toThrow('inventory unavailable')

    expect(await service.read.order(container, orderId)).toMatchObject({ status: 'pending', canceledAt: null })
    expect(await stockOf(service, inventoryItemId)).toMatchObject({ reservedQuantity: lineItem.quantity })
    // Payments are cancelled last because a void cannot be undone. This failure is upstream of that,
    // so the shopper's authorization is still there to be charged or voided later.
    expect(await service.read.payment(container, payment.id)).toMatchObject({ canceledAt: null })
  })

  test('refuses to cancel an order that is no longer pending', async ({ service, expect }) => {
    const { orderId } = await placedOrder(service)
    await service.update.order(container, orderId, { status: 'completed' })

    await expect(cancelOrderWorkflow.run({ orderId })).rejects.toThrow('status is "completed", expected "pending"')
  })

  test('refuses to cancel a fulfilled order, leaving its stock deducted', async ({ service, expect }) => {
    const { orderId, inventoryItemId } = await placedOrder(service)
    await service.create.fulfilledOrder(container, orderId)

    await expect(cancelOrderWorkflow.run({ orderId })).rejects.toThrow(
      'fulfillment status is "fulfilled", expected "unfulfilled"',
    )

    // The units are gone from the warehouse rather than committed to an order, so there is nothing
    // to put back — releasing here would invent stock the shopkeeper has already shipped.
    expect(await stockOf(service, inventoryItemId)).toEqual({
      stockedQuantity: 0,
      reservedQuantity: 0,
      availableQuantity: 0,
    })
  })
})
