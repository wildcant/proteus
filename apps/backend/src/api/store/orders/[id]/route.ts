import { AppError, ErrorTypes } from '@core/errors/app-error.js'
import type { IOrderModuleService } from '@core/types/index.js'
import { Modules } from '@core/utils/index.js'
import { IdParams, StoreOrderResponse } from '@proteus/http-schemas/store'
import type { HttpRequest, HttpResult } from '@server/ports.js'

export const GetInput = { params: IdParams }
export const GetOutput = StoreOrderResponse

// TODO: Replace unauthenticated access with a signed order access token (JWT scoped to order ID)
// so that order details are not accessible to anyone who knows the order UUID.
export const GET = async (req: HttpRequest<typeof GetInput>): Promise<HttpResult<typeof GetOutput>> => {
  const customerId = req.authContext?.actorId

  const orderService = req.scope.resolve<IOrderModuleService>(Modules.ORDER)
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

  const enrichedLineItems = orderService.enrichLineItems(lineItems)
  const totals = orderService.computeOrderTotals({ lineItems, shippingMethods, transactions })
  const paymentStatus = orderService.computePaymentStatus(totals)

  return {
    status: 200,
    json: {
      order: { ...order, lineItems: enrichedLineItems, shippingAddress, shippingMethods, totals, paymentStatus },
    },
  }
}
