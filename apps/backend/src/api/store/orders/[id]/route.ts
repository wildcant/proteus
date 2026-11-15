import { ErrorTypes } from '@core/errors/app-error.js'
import { ContainerRegistrationKeys } from '@core/utils/container.js'
import { Modules } from '@core/utils/modules-definition.js'
import type { HttpRequest, HttpResult } from '@framework/http/ports.js'
import { IdParams, StoreOrderResponse } from '@proteus/http-schemas/store'
import { computeFulfillmentStatus } from '@workflows/order/utils/compute-fulfillment-status.js'
import { computePaymentStatus } from '@workflows/order/utils/compute-payment-status.js'
import { orderReference } from '@workflows/order/utils/order-reference.js'

export const GetInput = { params: IdParams }
export const GetOutput = StoreOrderResponse

// Readable by anyone holding the id, drafts included: it is the shopper's shareable order link, and
// an Order id cannot be guessed. What it answers is allowlisted by `StoreOrderDetail`, so the link
// carries the email, the street and the phone only in `owner`, for the customer who placed it.
export const GetThrows = [ErrorTypes.NOT_FOUND] as const

export const GET = async (req: HttpRequest<typeof GetInput>): Promise<HttpResult<typeof GetOutput>> => {
  const customerId = req.authContext?.actorId

  const orderService = req.scope.resolve(Modules.ORDER)
  const linkService = req.scope.resolve(ContainerRegistrationKeys.LINK)
  const fulfillmentService = req.scope.resolve(Modules.FULFILLMENT)
  const paymentService = req.scope.resolve(Modules.PAYMENT)
  const order = await orderService.retrieveOrder(req.params.id)

  // A signed-in reader who did not place it is one more holder of the link: the public view, no `owner`.
  const isOwner = order.customerId !== null && order.customerId === customerId

  const [lineItems, shippingMethods, transactions, shippingAddress] = await Promise.all([
    orderService.listOrderLineItems({ orderId: order.id }),
    orderService.listOrderShippingMethods({ orderId: order.id }),
    orderService.listOrderTransactions({ orderId: order.id }),
    orderService.retrieveOrderAddress(order.id, 'shipping'),
  ])

  const link = await linkService.repo('orderFulfillment').findByOrderId(order.id)
  const fulfillments = link ? [await fulfillmentService.retrieveFulfillment(link.fulfillmentId)] : []
  const paymentLink = await linkService.repo('orderPaymentCollection').findByOrderId(order.id)
  const paymentCollections = paymentLink
    ? [await paymentService.retrievePaymentCollection(paymentLink.paymentCollectionId)]
    : []

  const totals = orderService.computeOrderTotals({ lineItems, shippingMethods, transactions })

  return {
    status: 200,
    json: {
      order: {
        id: order.id,
        displayId: order.displayId,
        reference: orderReference(order.displayId),
        status: order.status,
        paymentStatus: computePaymentStatus(paymentCollections),
        fulfillmentStatus: computeFulfillmentStatus(fulfillments),
        currencyCode: order.currencyCode,
        createdAt: order.createdAt,
        canceledAt: order.canceledAt,
        lineItems: orderService.enrichLineItems(lineItems),
        shippingAddress: shippingAddress && { city: shippingAddress.city, province: shippingAddress.province },
        shippingMethods,
        totals,
        ...(isOwner ? { owner: { email: order.email, shippingAddress } } : {}),
      },
    },
  }
}
