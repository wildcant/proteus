import type { IFulfillmentModuleService } from '@core/types/fulfillment/service.js'
import type { ILinkService } from '@core/types/link/service.js'
import type { IOrderModuleService } from '@core/types/order/service.js'
import { ContainerRegistrationKeys } from '@core/utils/container.js'
import { Modules } from '@core/utils/modules-definition.js'
import type { HttpRequest, HttpResult } from '@framework/http/ports.js'
import { AdminOrderActionResponse, IdParams } from '@proteus/http-schemas/admin'
import { computeFulfillmentStatus } from '@workflows/order/utils/compute-fulfillment-status.js'

export const PostInput = { params: IdParams }
export const PostOutput = AdminOrderActionResponse

export const POST = async (req: HttpRequest<typeof PostInput>): Promise<HttpResult<typeof PostOutput>> => {
  const orderService = req.scope.resolve<IOrderModuleService>(Modules.ORDER)
  const linkService = req.scope.resolve<ILinkService>(ContainerRegistrationKeys.LINK)
  const fulfillmentService = req.scope.resolve<IFulfillmentModuleService>(Modules.FULFILLMENT)

  const order = await orderService.archiveOrder(req.params.id)

  const link = await linkService.repo('orderFulfillment').findByOrderId(order.id)
  const fulfillments = link ? [await fulfillmentService.retrieveFulfillment(link.fulfillmentId)] : []
  const fulfillmentStatus = computeFulfillmentStatus(fulfillments)

  return { status: 200, json: { order: { ...order, fulfillmentStatus } } }
}
