import { AppError, ErrorTypes } from '@core/errors/app-error.js'
import type { IOrderModuleService } from '@core/types/index.js'
import { Modules } from '@core/utils/index.js'
import { StoreOrderListParams, StoreOrderListResponse } from '@proteus/http-schemas/store'
import type { HttpRequest, HttpResult } from '@server/ports.js'

export const GetInput = { query: StoreOrderListParams }
export const GetOutput = StoreOrderListResponse

export const GET = async (req: HttpRequest<typeof GetInput>): Promise<HttpResult<typeof GetOutput>> => {
  const customerId = req.authContext?.actorId
  if (!customerId) {
    throw new AppError({ type: ErrorTypes.UNAUTHORIZED, message: 'Not authenticated' })
  }

  const orderService = req.scope.resolve<IOrderModuleService>(Modules.ORDER)
  const { pagination } = req.validatedQuery
  const [orders, count] = await orderService.listAndCountOrders({ customerId }, pagination)
  const { offset, limit } = pagination

  const orderIds = orders.map((order) => order.id)
  const [allLineItems, allShippingMethods] = await Promise.all([
    orderService.listOrderLineItems({ orderId: orderIds }),
    orderService.listOrderShippingMethods({ orderId: orderIds }),
  ])

  const enrichedOrders = orders.map((order) => {
    const items = allLineItems.filter((item) => item.orderId === order.id)
    const shippingMethods = allShippingMethods.filter((method) => method.orderId === order.id)
    const totals = orderService.computeOrderTotals({ lineItems: items, shippingMethods, transactions: [] })
    return { ...order, items, total: totals.orderTotal }
  })

  return { status: 200, json: { orders: enrichedOrders, count, offset, limit } }
}
