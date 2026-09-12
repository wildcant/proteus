import type { HttpRequest, HttpResult } from '@framework/http/ports.js'
import { AdminOrderActionResponse, IdParams } from '@proteus/http-schemas/admin'
import { cancelOrderWorkflow } from '@workflows/order/cancel-order.js'

export const PostInput = { params: IdParams }
export const PostOutput = AdminOrderActionResponse
export const PostThrows = [...cancelOrderWorkflow.throws] as const

export const POST = async (req: HttpRequest<typeof PostInput>): Promise<HttpResult<typeof PostOutput>> => {
  const order = await cancelOrderWorkflow.run({ orderId: req.params.id })
  return { status: 200, json: { order } }
}
