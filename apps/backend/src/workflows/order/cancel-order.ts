import { BigNumber } from '@core/bignumber.js'
import { ErrorTypes } from '@core/errors/app-error.js'
import type { OrderDTO } from '@core/types/order/common.js'
import { ContainerRegistrationKeys } from '@core/utils/container.js'
import { Modules } from '@core/utils/modules-definition.js'
import { createWorkflow, WorkflowTerminalError } from '@core/workflows/types.js'
import { i18n } from '@proteus/utils'
import { type PlannedRefund, refundPaymentsStep } from '../payment/steps/refund-payments.js'
import { addOrderTransactionsStep } from './steps/add-order-transactions.js'
import { computeFulfillmentStatus } from './utils/compute-fulfillment-status.js'

type CancelOrderInput = {
  orderId: string
  /**
   * How much of what the Order received to return, from nothing to all of it. Omitted, all of it:
   * Medusa's cancel refunds every captured payment, and Proteus lets the admin keep part instead.
   */
  refundAmount?: BigNumber | undefined
}

/**
 * Cancels an unfulfilled Order: releases its stock, returns the chosen part of what it received
 * (one negative Order transaction per refund), voids whatever its authorization still holds, and
 * marks it canceled (Medusa's `cancelOrderWorkflow`).
 */
export const cancelOrderWorkflow = createWorkflow<CancelOrderInput, OrderDTO>(
  { name: 'cancel-order', throws: [ErrorTypes.NOT_ALLOWED, ErrorTypes.INVALID_DATA] },
  async (ctx, input) => {
    /** Guard: only unfulfilled orders can be canceled. */
    await ctx.step('validate-fulfillment-status', async ({ container }) => {
      const fulfillmentService = container.resolve(Modules.FULFILLMENT)
      const linkService = container.resolve(ContainerRegistrationKeys.LINK)

      const link = await linkService.repo('orderFulfillment').findByOrderId(input.orderId)
      const fulfillments = link ? [await fulfillmentService.retrieveFulfillment(link.fulfillmentId)] : []
      const status = computeFulfillmentStatus(fulfillments)

      if (status !== 'unfulfilled') {
        throw new WorkflowTerminalError({
          type: ErrorTypes.NOT_ALLOWED,
          message: i18n.t('Cannot cancel order {orderId}: fulfillment status is "{status}", expected "unfulfilled"'),
          values: { orderId: input.orderId, status },
        })
      }
    })

    /** Decide what is returned before anything changes, so a refund above what the Order received
     *  is refused with the Order still standing. Spread over the payments that received money (one,
     *  in practice), each refund keyed so a retry of the refund step returns the money once. */
    const refundPlan = await ctx.step('plan-cancel-refunds', async ({ container }) => {
      const paymentService = container.resolve(Modules.PAYMENT)
      const linkService = container.resolve(ContainerRegistrationKeys.LINK)

      const link = await linkService.repo('orderPaymentCollection').findByOrderId(input.orderId)
      const collection = link ? await paymentService.retrievePaymentCollection(link.paymentCollectionId) : null
      const received = (collection?.payments ?? []).map((payment) => {
        const captured = (payment.captures ?? []).reduce((sum, row) => sum.plus(row.amount), new BigNumber(0))
        const refunded = (payment.refunds ?? []).reduce((sum, row) => sum.plus(row.amount), new BigNumber(0))
        return { paymentId: payment.id, received: captured.minus(refunded) }
      })
      const totalReceived = received.reduce((sum, row) => sum.plus(row.received), new BigNumber(0))
      const refundAmount = input.refundAmount ?? totalReceived

      if (refundAmount.isNegative() || refundAmount.isGreaterThan(totalReceived)) {
        throw new WorkflowTerminalError({
          type: ErrorTypes.INVALID_DATA,
          message: i18n.t(
            'Cannot cancel order {orderId}: a refund of {amount} is not between 0 and the {received} received.',
          ),
          values: { orderId: input.orderId, amount: refundAmount.toFixed(), received: totalReceived.toFixed() },
        })
      }

      const key = crypto.randomUUID()
      const refunds: PlannedRefund[] = []
      let left = refundAmount
      for (const row of received) {
        if (!left.isGreaterThan(0)) break
        const amount = BigNumber.min(left, row.received)
        if (!amount.isGreaterThan(0)) continue
        refunds.push({ paymentId: row.paymentId, amount, idempotencyKey: `${key}:${row.paymentId}` })
        left = left.minus(amount)
      }

      return { refunds, orderId: input.orderId }
    })

    /** Validate and mark the order as canceled — rejects non-pending orders. */
    const canceled = await ctx.step(
      'cancel-order',
      async ({ container }) => {
        const orderService = container.resolve(Modules.ORDER)
        return orderService.cancelOrder(input.orderId)
      },
      async (order, { container }) => {
        const orderService = container.resolve(Modules.ORDER)
        await orderService.updateOrder(order.id, { status: 'pending', canceledAt: null })
      },
    )

    /** Release inventory reservations held by this order's line items so the
     *  stock becomes available again. Safe to run before payment cancellation
     *  since reservation deletion is a reversible DB operation. */
    await ctx.step(
      'delete-reservations',
      async ({ container }) => {
        const orderService = container.resolve(Modules.ORDER)
        const inventoryService = container.resolve(Modules.INVENTORY)

        const lineItems = await orderService.listOrderLineItems({ orderId: input.orderId })
        const lineItemIds = lineItems.map((item) => item.id)

        if (lineItemIds.length === 0) return []

        const reservations = await inventoryService.listReservationItems({ lineItemId: lineItemIds })
        if (reservations.length === 0) return []

        const reservationIds = reservations.map((reservation) => reservation.id)
        await inventoryService.softDeleteReservationItems(reservationIds)
        return reservationIds
      },
      async (deletedIds, { container }) => {
        if (deletedIds.length === 0) return
        const inventoryService = container.resolve(Modules.INVENTORY)
        await inventoryService.restoreReservationItems(deletedIds)
      },
    )

    /** Payments last — these are irreversible provider-side operations. First the refund the
     *  admin chose, each written as an Order transaction so the Paid Total shows what was kept. */
    const refunded = await refundPaymentsStep(ctx, refundPlan)
    await addOrderTransactionsStep(ctx, refunded)

    /** Then void what the authorizations still hold, so no money can be captured against a
     *  canceled Order. A fully captured payment has nothing left to void and is left alone. */
    await ctx.step('cancel-payments', async ({ container }) => {
      const paymentService = container.resolve(Modules.PAYMENT)
      const linkService = container.resolve(ContainerRegistrationKeys.LINK)

      const link = await linkService.repo('orderPaymentCollection').findByOrderId(input.orderId)
      if (!link) return

      const collection = await paymentService.retrievePaymentCollection(link.paymentCollectionId)

      const holding = (collection.payments ?? []).filter((payment) => {
        if (payment.canceledAt) return false
        const captured = (payment.captures ?? []).reduce((sum, row) => sum.plus(row.amount), new BigNumber(0))
        return captured.isLessThan(payment.amount)
      })

      await Promise.all(holding.map((payment) => paymentService.cancelPayment(payment.id)))
    })

    return canceled
  },
)
