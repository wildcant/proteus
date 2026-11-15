import { ContainerRegistrationKeys } from '@core/utils/container.js'
import { Modules } from '@core/utils/modules-definition.js'
import type { HttpRequest, HttpResult } from '@framework/http/ports.js'
import { AdminOrderResponse, IdParams } from '@proteus/http-schemas/admin'
import { computeAllowedActions } from '@workflows/order/utils/compute-allowed-actions.js'
import { computeFulfillmentStatus } from '@workflows/order/utils/compute-fulfillment-status.js'
import { computePaymentStatus } from '@workflows/order/utils/compute-payment-status.js'

export const GetInput = { params: IdParams }
export const GetOutput = AdminOrderResponse

export const GET = async (req: HttpRequest<typeof GetInput>): Promise<HttpResult<typeof GetOutput>> => {
  const orderService = req.scope.resolve(Modules.ORDER)
  const linkService = req.scope.resolve(ContainerRegistrationKeys.LINK)
  const fulfillmentService = req.scope.resolve(Modules.FULFILLMENT)
  const paymentService = req.scope.resolve(Modules.PAYMENT)

  const [order, lineItems, shippingMethods, transactions, shippingAddress] = await Promise.all([
    orderService.retrieveOrder(req.params.id),
    orderService.listOrderLineItems({ orderId: req.params.id }),
    orderService.listOrderShippingMethods({ orderId: req.params.id }),
    orderService.listOrderTransactions({ orderId: req.params.id }),
    orderService.retrieveOrderAddress(req.params.id, 'shipping'),
  ])

  const [orderFulfillmentLink, orderPaymentCollectionLink] = await Promise.all([
    linkService.repo('orderFulfillment').findByOrderId(req.params.id),
    linkService.repo('orderPaymentCollection').findByOrderId(req.params.id),
  ])
  // One collection per Order, served as Medusa's list so a reader does not special-case the count.
  const [fulfillments, paymentCollections] = await Promise.all([
    orderFulfillmentLink
      ? fulfillmentService.retrieveFulfillment(orderFulfillmentLink.fulfillmentId).then((row) => [row])
      : [],
    orderPaymentCollectionLink
      ? paymentService.retrievePaymentCollection(orderPaymentCollectionLink.paymentCollectionId).then((row) => [row])
      : [],
  ])

  const enrichedLineItems = orderService.enrichLineItems(lineItems)
  const totals = orderService.computeOrderTotals({ lineItems, shippingMethods, transactions })
  const fulfillmentStatus = computeFulfillmentStatus(fulfillments)
  const paymentStatus = computePaymentStatus(paymentCollections)
  const allowedActions = computeAllowedActions(order, fulfillmentStatus)

  return {
    status: 200,
    json: {
      order: {
        ...order,
        fulfillmentStatus,
        lineItems: enrichedLineItems,
        shippingMethods,
        transactions,
        totals,
        paymentStatus,
        allowedActions,
        shippingAddress,
        fulfillments,
        paymentCollections,
      },
    },
  }
}
