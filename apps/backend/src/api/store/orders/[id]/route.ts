import { AppError, ErrorTypes } from '@core/errors/app-error.js'
import { ContainerRegistrationKeys } from '@core/utils/container.js'
import { Modules } from '@core/utils/modules-definition.js'
import type { HttpRequest, HttpResult } from '@framework/http/ports.js'
import { IdParams, StoreOrderResponse } from '@proteus/http-schemas/store'
import { computeFulfillmentStatus } from '@workflows/order/utils/compute-fulfillment-status.js'
import { computePaymentStatus } from '@workflows/order/utils/compute-payment-status.js'

export const GetInput = { params: IdParams }
export const GetOutput = StoreOrderResponse

// TODO: Replace unauthenticated access with a signed order access token (JWT scoped to order ID)
// so that order details are not accessible to anyone who knows the order UUID.
export const GetThrows = [ErrorTypes.NOT_FOUND] as const

export const GET = async (req: HttpRequest<typeof GetInput>): Promise<HttpResult<typeof GetOutput>> => {
  const customerId = req.authContext?.actorId

  const orderService = req.scope.resolve(Modules.ORDER)
  const linkService = req.scope.resolve(ContainerRegistrationKeys.LINK)
  const fulfillmentService = req.scope.resolve(Modules.FULFILLMENT)
  const order = await orderService.retrieveOrder(req.params.id)

  if (customerId && order.customerId !== customerId) {
    throw new AppError({ type: ErrorTypes.NOT_FOUND, message: `Order with id "${req.params.id}" not found` })
  }

  const [lineItems, shippingMethods, transactions, shippingAddress] = await Promise.all([
    orderService.listOrderLineItems({ orderId: order.id }),
    orderService.listOrderShippingMethods({ orderId: order.id }),
    orderService.listOrderTransactions({ orderId: order.id }),
    orderService.retrieveOrderAddress(order.id, 'shipping'),
  ])

  const link = await linkService.repo('orderFulfillment').findByOrderId(order.id)
  const fulfillments = link ? [await fulfillmentService.retrieveFulfillment(link.fulfillmentId)] : []

  const enrichedLineItems = orderService.enrichLineItems(lineItems)
  const totals = orderService.computeOrderTotals({ lineItems, shippingMethods, transactions })
  const fulfillmentStatus = computeFulfillmentStatus(fulfillments)
  const paymentStatus = computePaymentStatus(totals)

  return {
    status: 200,
    json: {
      order: {
        ...order,
        fulfillmentStatus,
        lineItems: enrichedLineItems,
        shippingAddress,
        shippingMethods,
        totals,
        paymentStatus,
      },
    },
  }
}
