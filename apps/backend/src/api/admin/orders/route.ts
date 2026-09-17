import type { IFulfillmentModuleService } from '@core/types/fulfillment/service.js'
import type { ILinkService } from '@core/types/link/service.js'
import type { IOrderModuleService } from '@core/types/order/service.js'
import { ContainerRegistrationKeys } from '@core/utils/container.js'
import { Modules } from '@core/utils/modules-definition.js'
import type { HttpRequest, HttpResult } from '@framework/http/ports.js'
import { AdminOrderListParams, AdminOrderListResponse } from '@proteus/http-schemas/admin'
import { computeFulfillmentStatus } from '@workflows/order/utils/compute-fulfillment-status.js'

export const GetInput = { query: AdminOrderListParams }
export const GetOutput = AdminOrderListResponse

export const GET = async (req: HttpRequest<typeof GetInput>): Promise<HttpResult<typeof GetOutput>> => {
  const orderService = req.scope.resolve<IOrderModuleService>(Modules.ORDER)
  const linkService = req.scope.resolve<ILinkService>(ContainerRegistrationKeys.LINK)
  const fulfillmentService = req.scope.resolve<IFulfillmentModuleService>(Modules.FULFILLMENT)

  const { pagination, filters } = req.validatedQuery
  const [orders, count] = await orderService.listAndCountOrders(filters, pagination)
  const { offset, limit } = pagination

  const orderIds = orders.map((order) => order.id)
  const links = await linkService.repo('orderFulfillment').findByOrderIds(orderIds)
  const fulfillmentIds = links.map((link) => link.fulfillmentId)
  const fulfillments =
    fulfillmentIds.length > 0 ? await fulfillmentService.listFulfillments({ id: fulfillmentIds }) : []
  const fulfillmentByOrderId = new Map(
    links.map((link) => [link.orderId, fulfillments.find((f) => f.id === link.fulfillmentId)]),
  )

  const enrichedOrders = orders.map((order) => {
    const fulfillment = fulfillmentByOrderId.get(order.id)
    const fulfillmentStatus = computeFulfillmentStatus(fulfillment ? [fulfillment] : [])
    return { ...order, fulfillmentStatus }
  })

  return { status: 200, json: { orders: enrichedOrders, count, offset, limit } }
}
