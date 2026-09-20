import { Modules } from '@core/utils/modules-definition.js'
import type { HttpRequest, HttpResult } from '@framework/http/ports.js'
import { AdminOrderActionResponse, OrderFulfillmentIdParams } from '@proteus/http-schemas/admin'
import { markOrderDeliveredWorkflow } from '@workflows/order/mark-order-delivered.js'
import { computeFulfillmentStatus } from '@workflows/order/utils/compute-fulfillment-status.js'

export const PostInput = { params: OrderFulfillmentIdParams }
export const PostOutput = AdminOrderActionResponse
export const PostThrows = [...markOrderDeliveredWorkflow.throws] as const

export const POST = async (req: HttpRequest<typeof PostInput>): Promise<HttpResult<typeof PostOutput>> => {
  const fulfillmentService = req.scope.resolve(Modules.FULFILLMENT)

  const order = await markOrderDeliveredWorkflow.run({
    orderId: req.params.id,
    fulfillmentId: req.params.fulfillmentId,
  })

  const fulfillment = await fulfillmentService.retrieveFulfillment(req.params.fulfillmentId)
  const fulfillmentStatus = computeFulfillmentStatus([fulfillment])

  return { status: 200, json: { order: { ...order, fulfillmentStatus } } }
}
