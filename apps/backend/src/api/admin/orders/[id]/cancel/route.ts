import { ContainerRegistrationKeys } from '@core/utils/container.js'
import { Modules } from '@core/utils/modules-definition.js'
import type { HttpRequest, HttpResult } from '@framework/http/ports.js'
import { AdminCancelOrder, AdminOrderActionResponse, IdParams } from '@proteus/http-schemas/admin'
import { cancelOrderWorkflow } from '@workflows/order/cancel-order.js'
import { computeFulfillmentStatus } from '@workflows/order/utils/compute-fulfillment-status.js'
import { orderReference } from '@workflows/order/utils/order-reference.js'

export const PostInput = { params: IdParams, body: AdminCancelOrder }
export const PostOutput = AdminOrderActionResponse
export const PostThrows = [...cancelOrderWorkflow.throws] as const

export const POST = async (req: HttpRequest<typeof PostInput>): Promise<HttpResult<typeof PostOutput>> => {
  const linkService = req.scope.resolve(ContainerRegistrationKeys.LINK)
  const fulfillmentService = req.scope.resolve(Modules.FULFILLMENT)

  const order = await cancelOrderWorkflow.run({ orderId: req.params.id, refundAmount: req.body.refundAmount })

  const link = await linkService.repo('orderFulfillment').findByOrderId(order.id)
  const fulfillments = link ? [await fulfillmentService.retrieveFulfillment(link.fulfillmentId)] : []
  const fulfillmentStatus = computeFulfillmentStatus(fulfillments)

  return { status: 200, json: { order: { ...order, reference: orderReference(order.displayId), fulfillmentStatus } } }
}
