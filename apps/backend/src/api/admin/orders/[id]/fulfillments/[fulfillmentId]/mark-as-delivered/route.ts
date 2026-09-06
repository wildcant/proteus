import { AdminOrderActionResponse, OrderFulfillmentIdParams } from '@proteus/http-schemas/admin'
import type { HttpRequest, HttpResult } from '@server/ports.js'
import { markOrderDeliveredWorkflow } from '@workflows/order/mark-order-delivered.js'

export const PostInput = { params: OrderFulfillmentIdParams }
export const PostOutput = AdminOrderActionResponse

export const POST = async (req: HttpRequest<typeof PostInput>): Promise<HttpResult<typeof PostOutput>> => {
  const order = await markOrderDeliveredWorkflow.run({
    orderId: req.params.id,
    fulfillmentId: req.params.fulfillmentId,
  })
  return { status: 200, json: { order } }
}
