import { Modules } from '@core/utils/modules-definition.js'
import type { HttpRequest, HttpResult } from '@framework/http/ports.js'
import {
  AdminCreateOrderShipment,
  AdminOrderActionResponse,
  OrderFulfillmentIdParams,
} from '@proteus/http-schemas/admin'
import { createOrderShipmentWorkflow } from '@workflows/order/create-order-shipment.js'
import { computeFulfillmentStatus } from '@workflows/order/utils/compute-fulfillment-status.js'

export const PostInput = { params: OrderFulfillmentIdParams, body: AdminCreateOrderShipment }
export const PostOutput = AdminOrderActionResponse
export const PostThrows = [...createOrderShipmentWorkflow.throws] as const

export const POST = async (req: HttpRequest<typeof PostInput>): Promise<HttpResult<typeof PostOutput>> => {
  const fulfillmentService = req.scope.resolve(Modules.FULFILLMENT)

  const order = await createOrderShipmentWorkflow.run({
    orderId: req.params.id,
    fulfillmentId: req.params.fulfillmentId,
    ...req.body,
  })

  const fulfillment = await fulfillmentService.retrieveFulfillment(req.params.fulfillmentId)
  const fulfillmentStatus = computeFulfillmentStatus([fulfillment])

  return { status: 200, json: { order: { ...order, fulfillmentStatus } } }
}
