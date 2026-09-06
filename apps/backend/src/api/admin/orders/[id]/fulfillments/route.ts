import { AdminCreateOrderFulfillment, AdminOrderActionResponse, IdParams } from '@proteus/http-schemas/admin'
import type { HttpRequest, HttpResult } from '@server/ports.js'
import { createOrderFulfillmentWorkflow } from '@workflows/order/create-order-fulfillment.js'

export const PostInput = { params: IdParams, body: AdminCreateOrderFulfillment }
export const PostOutput = AdminOrderActionResponse

export const POST = async (req: HttpRequest<typeof PostInput>): Promise<HttpResult<typeof PostOutput>> => {
  const order = await createOrderFulfillmentWorkflow.run({
    orderId: req.params.id,
    locationId: req.body.locationId,
    fulfillmentData: req.body,
  })
  return { status: 200, json: { order } }
}
