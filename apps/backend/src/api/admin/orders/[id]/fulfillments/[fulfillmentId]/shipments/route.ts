import {
  AdminCreateOrderShipment,
  AdminOrderActionResponse,
  OrderFulfillmentIdParams,
} from '@proteus/http-schemas/admin'
import type { HttpRequest, HttpResult } from '../../../../../../../server/ports.js'
import { createOrderShipmentWorkflow } from '../../../../../../../workflows/order/create-order-shipment.js'

export const PostInput = { params: OrderFulfillmentIdParams, body: AdminCreateOrderShipment }
export const PostOutput = AdminOrderActionResponse

export const POST = async (req: HttpRequest<typeof PostInput>): Promise<HttpResult<typeof PostOutput>> => {
  const order = await createOrderShipmentWorkflow.run({
    orderId: req.params.id,
    fulfillmentId: req.params.fulfillmentId,
    ...req.body,
  })
  return { status: 200, json: { order } }
}
