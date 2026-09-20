import { ErrorTypes } from '@core/errors/app-error.js'
import type { OrderDTO } from '@core/types/order/common.js'
import { ContainerRegistrationKeys } from '@core/utils/container.js'
import { Modules } from '@core/utils/modules-definition.js'
import { createWorkflow, WorkflowTerminalError } from '@core/workflows/types.js'
import { computeFulfillmentStatus } from './utils/compute-fulfillment-status.js'

type CancelOrderInput = { orderId: string }

export const cancelOrderWorkflow = createWorkflow<CancelOrderInput, OrderDTO>(
  { name: 'cancel-order', throws: [ErrorTypes.NOT_ALLOWED] },
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
          message: `Cannot cancel order ${input.orderId}: fulfillment status is "${status}", expected "unfulfilled"`,
        })
      }
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

    /** Cancel or refund payments last — these are irreversible provider-side operations.
     *  Uncaptured payments are voided; captured payments are fully refunded. */
    await ctx.step('cancel-payments', async ({ container }) => {
      const paymentService = container.resolve(Modules.PAYMENT)
      const linkService = container.resolve(ContainerRegistrationKeys.LINK)

      const link = await linkService.repo('orderPaymentCollection').findByOrderId(input.orderId)
      if (!link) return

      const collection = await paymentService.retrievePaymentCollection(link.paymentCollectionId)

      const activePayments = (collection.payments ?? []).filter((payment) => !payment.canceledAt)

      await Promise.all(
        activePayments.map((payment) => {
          const hasCaptured = payment.captures && payment.captures.length > 0
          if (hasCaptured) {
            return paymentService.refundPayment({ paymentId: payment.id })
          }
          return paymentService.cancelPayment(payment.id)
        }),
      )
    })

    return canceled
  },
)
