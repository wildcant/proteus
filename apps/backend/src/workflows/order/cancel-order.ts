import type { IInventoryModuleService } from '@core/types/inventory/service.js'
import type { ILinkService } from '@core/types/link/service.js'
import type { OrderDTO } from '@core/types/order/common.js'
import type { IOrderModuleService } from '@core/types/order/service.js'
import type { IPaymentModuleService } from '@core/types/payment/service.js'
import { ContainerRegistrationKeys, Modules } from '@core/utils/index.js'
import { createWorkflow } from '@core/workflows/types.js'

type CancelOrderInput = { orderId: string }

export const cancelOrderWorkflow = createWorkflow<CancelOrderInput, OrderDTO>('cancel-order', async (ctx, input) => {
  /** Validate and mark the order as canceled first — this is a reversible DB update
   *  and acts as a guard (rejects non-pending or already-fulfilled orders). */
  const canceled = await ctx.step(
    'cancel-order',
    async ({ container }) => {
      const orderService = container.resolve<IOrderModuleService>(Modules.ORDER)
      return orderService.cancelOrder(input.orderId)
    },
    async (order, { container }) => {
      const orderService = container.resolve<IOrderModuleService>(Modules.ORDER)
      await orderService.updateOrder(order.id, { status: 'pending', canceledAt: null })
    },
  )

  /** Release inventory reservations held by this order's line items so the
   *  stock becomes available again. Safe to run before payment cancellation
   *  since reservation deletion is a reversible DB operation. */
  await ctx.step(
    'delete-reservations',
    async ({ container }) => {
      const orderService = container.resolve<IOrderModuleService>(Modules.ORDER)
      const inventoryService = container.resolve<IInventoryModuleService>(Modules.INVENTORY)

      const lineItems = await orderService.listOrderLineItems({ orderId: input.orderId })
      const lineItemIds = lineItems.map((item) => item.id)

      if (lineItemIds.length === 0) return []

      const reservations = await inventoryService.listReservationItems({ lineItemId: lineItemIds })
      if (reservations.length === 0) return []

      const reservationIds = reservations.map((reservation) => reservation.id)
      await inventoryService.deleteReservationItems(reservationIds)
      return reservationIds
    },
    async (deletedIds, { container }) => {
      if (deletedIds.length === 0) return
      const inventoryService = container.resolve<IInventoryModuleService>(Modules.INVENTORY)
      await inventoryService.restoreReservationItems(deletedIds)
    },
  )

  /** Cancel or refund payments last — these are irreversible provider-side operations.
   *  Uncaptured payments are voided; captured payments are fully refunded. */
  await ctx.step('cancel-payments', async ({ container }) => {
    const paymentService = container.resolve<IPaymentModuleService>(Modules.PAYMENT)
    const linkService = container.resolve<ILinkService>(ContainerRegistrationKeys.LINK)

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
})
