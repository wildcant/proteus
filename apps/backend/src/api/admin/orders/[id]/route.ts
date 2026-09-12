import type { IOrderModuleService } from '@core/types/order/service.js'
import { Modules } from '@core/utils/modules-definition.js'
import type { HttpRequest, HttpResult } from '@framework/http/ports.js'
import { AdminOrderResponse, IdParams } from '@proteus/http-schemas/admin'

export const GetInput = { params: IdParams }
export const GetOutput = AdminOrderResponse

export const GET = async (req: HttpRequest<typeof GetInput>): Promise<HttpResult<typeof GetOutput>> => {
  const orderService = req.scope.resolve<IOrderModuleService>(Modules.ORDER)
  const [order, lineItems, shippingMethods, transactions] = await Promise.all([
    orderService.retrieveOrder(req.params.id),
    orderService.listOrderLineItems({ orderId: req.params.id }),
    orderService.listOrderShippingMethods({ orderId: req.params.id }),
    orderService.listOrderTransactions({ orderId: req.params.id }),
  ])
  const enrichedLineItems = orderService.enrichLineItems(lineItems)
  const totals = orderService.computeOrderTotals({ lineItems, shippingMethods, transactions })
  const allowedActions = orderService.computeAllowedActions(order)
  return {
    status: 200,
    json: { order: { ...order, lineItems: enrichedLineItems, shippingMethods, transactions, totals, allowedActions } },
  }
}
