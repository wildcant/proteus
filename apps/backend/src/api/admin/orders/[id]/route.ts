import type { IOrderModuleService } from '@core/types/index.js'
import { Modules } from '@core/utils/index.js'
import { AdminOrderResponse, IdParams } from '@proteus/http-schemas/admin'
import type { HttpRequest, HttpResult } from '../../../../server/ports.js'

export const GetInput = { params: IdParams }
export const GetOutput = AdminOrderResponse

export const GET = async (req: HttpRequest<typeof GetInput>): Promise<HttpResult<typeof GetOutput>> => {
  const orderService = req.scope.resolve<IOrderModuleService>(Modules.ORDER)
  const [order, lineItems, shippingMethods, transactions, totals] = await Promise.all([
    orderService.retrieveOrder(req.params.id),
    orderService.listOrderLineItems({ orderId: req.params.id }),
    orderService.listOrderShippingMethods({ orderId: req.params.id }),
    orderService.listOrderTransactions({ orderId: req.params.id }),
    orderService.computeOrderTotals(req.params.id),
  ])
  const allowedActions = orderService.computeAllowedActions(order)
  const enrichedLineItems = lineItems.map((item) => ({
    ...item,
    lineTotal: item.unitPrice.multipliedBy(item.quantity),
  }))
  return {
    status: 200,
    json: { order: { ...order, lineItems: enrichedLineItems, shippingMethods, transactions, totals, allowedActions } },
  }
}
