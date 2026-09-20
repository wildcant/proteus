import { AppError, ErrorTypes } from '@core/errors/app-error.js'
import { ContainerRegistrationKeys } from '@core/utils/container.js'
import { Modules } from '@core/utils/modules-definition.js'
import type { HttpRequest, HttpResult } from '@framework/http/ports.js'
import { StoreOrderListParams, StoreOrderListResponse } from '@proteus/http-schemas/store'
import { computeFulfillmentStatus } from '@workflows/order/utils/compute-fulfillment-status.js'

export const GetInput = { query: StoreOrderListParams }
export const GetOutput = StoreOrderListResponse
export const GetThrows = [ErrorTypes.UNAUTHORIZED] as const

export const GET = async (req: HttpRequest<typeof GetInput>): Promise<HttpResult<typeof GetOutput>> => {
  const customerId = req.authContext?.actorId
  if (!customerId) {
    throw new AppError({ type: ErrorTypes.UNAUTHORIZED, message: 'Not authenticated' })
  }

  const orderService = req.scope.resolve(Modules.ORDER)
  const linkService = req.scope.resolve(ContainerRegistrationKeys.LINK)
  const fulfillmentService = req.scope.resolve(Modules.FULFILLMENT)
  const { pagination } = req.validatedQuery
  const [orders, count] = await orderService.listAndCountOrders({ customerId }, pagination)
  const { offset, limit } = pagination

  const orderIds = orders.map((order) => order.id)
  const [allLineItems, allShippingMethods, links] = await Promise.all([
    orderService.listOrderLineItems({ orderId: orderIds }),
    orderService.listOrderShippingMethods({ orderId: orderIds }),
    linkService.repo('orderFulfillment').findByOrderIds(orderIds),
  ])

  const fulfillmentIds = links.map((link) => link.fulfillmentId)
  const allFulfillments =
    fulfillmentIds.length > 0 ? await fulfillmentService.listFulfillments({ id: fulfillmentIds }) : []
  const fulfillmentByOrderId = new Map(
    links.map((link) => [link.orderId, allFulfillments.find((f) => f.id === link.fulfillmentId)]),
  )

  const enrichedOrders = orders.map((order) => {
    const items = allLineItems.filter((item) => item.orderId === order.id)
    const shippingMethods = allShippingMethods.filter((method) => method.orderId === order.id)
    const totals = orderService.computeOrderTotals({ lineItems: items, shippingMethods, transactions: [] })
    const fulfillment = fulfillmentByOrderId.get(order.id)
    const fulfillmentStatus = computeFulfillmentStatus(fulfillment ? [fulfillment] : [])
    return { ...order, fulfillmentStatus, items, total: totals.orderTotal }
  })

  return { status: 200, json: { orders: enrichedOrders, count, offset, limit } }
}
