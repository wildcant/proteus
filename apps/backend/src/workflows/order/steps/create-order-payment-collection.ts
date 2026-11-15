import { ContainerRegistrationKeys } from '@core/utils/container.js'
import { Modules } from '@core/utils/modules-definition.js'
import type { WorkflowContext } from '@core/workflows/types.js'

type CreateOrderPaymentCollectionInput = { orderId: string }

type StepOutput = {
  paymentCollectionId: string
  /** False when the Order already had its collection, so the rollback leaves that one alone. */
  created: boolean
}

/**
 * Gives an existing Order its payment collection, for its total, and the `orderPaymentCollection`
 * link the payment reads and record-payment find it through.
 *
 * One collection per Order, as in Medusa: the payments recorded against it are
 * captures of part of it, so its amount has to be the Order's whole total. A Cart's checkout does
 * not need this — completing it links the collection the Cart was paid through, already for the
 * same total. A draft converted to an Order does, because a draft holds no collection.
 *
 * An Order already holding one answers with it, so a retried step does not open a second.
 */
export async function createOrderPaymentCollectionStep(
  ctx: WorkflowContext,
  input: CreateOrderPaymentCollectionInput,
): Promise<StepOutput> {
  return ctx.step<StepOutput>(
    'create-order-payment-collection',
    async ({ container }) => {
      const linkService = container.resolve(ContainerRegistrationKeys.LINK)
      const existing = await linkService.repo('orderPaymentCollection').findByOrderId(input.orderId)
      if (existing) return { paymentCollectionId: existing.paymentCollectionId, created: false }

      const orderService = container.resolve(Modules.ORDER)
      const paymentService = container.resolve(Modules.PAYMENT)

      const [order, lineItems, shippingMethods] = await Promise.all([
        orderService.retrieveOrder(input.orderId),
        orderService.listOrderLineItems({ orderId: input.orderId }),
        orderService.listOrderShippingMethods({ orderId: input.orderId }),
      ])
      const { orderTotal } = orderService.computeOrderTotals({ lineItems, shippingMethods, transactions: [] })

      const collection = await paymentService.createPaymentCollection({
        amount: orderTotal,
        currencyCode: order.currencyCode,
      })
      await linkService.createMany([
        { link: 'orderPaymentCollection', data: { orderId: order.id, paymentCollectionId: collection.id } },
      ])

      return { paymentCollectionId: collection.id, created: true }
    },
    async ({ paymentCollectionId, created }, { container }) => {
      if (!created) return

      const linkService = container.resolve(ContainerRegistrationKeys.LINK)
      const paymentService = container.resolve(Modules.PAYMENT)
      await linkService.dismissLinks({ paymentCollectionId: [paymentCollectionId] })
      await paymentService.softDeletePaymentCollections([paymentCollectionId])
    },
  )
}
