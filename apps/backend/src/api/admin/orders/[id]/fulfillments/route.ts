import type { IFulfillmentModuleService } from '@core/types/fulfillment/service.js'
import type { ILinkService } from '@core/types/link/service.js'
import { ContainerRegistrationKeys } from '@core/utils/container.js'
import { Modules } from '@core/utils/modules-definition.js'
import type { HttpRequest, HttpResult } from '@framework/http/ports.js'
import { AdminCreateOrderFulfillment, AdminOrderActionResponse, IdParams } from '@proteus/http-schemas/admin'
import { createOrderFulfillmentWorkflow } from '@workflows/order/create-order-fulfillment.js'
import { computeFulfillmentStatus } from '@workflows/order/utils/compute-fulfillment-status.js'

export const PostInput = { params: IdParams, body: AdminCreateOrderFulfillment }
export const PostOutput = AdminOrderActionResponse
export const PostThrows = [...createOrderFulfillmentWorkflow.throws] as const

export const POST = async (req: HttpRequest<typeof PostInput>): Promise<HttpResult<typeof PostOutput>> => {
  const linkService = req.scope.resolve<ILinkService>(ContainerRegistrationKeys.LINK)
  const fulfillmentService = req.scope.resolve<IFulfillmentModuleService>(Modules.FULFILLMENT)

  const order = await createOrderFulfillmentWorkflow.run({ orderId: req.params.id, fulfillmentData: req.body })

  const link = await linkService.repo('orderFulfillment').findByOrderId(order.id)
  const fulfillments = link ? [await fulfillmentService.retrieveFulfillment(link.fulfillmentId)] : []
  const fulfillmentStatus = computeFulfillmentStatus(fulfillments)

  return { status: 200, json: { order: { ...order, fulfillmentStatus } } }
}
