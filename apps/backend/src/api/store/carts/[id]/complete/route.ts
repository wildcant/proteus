import type { HttpRequest, HttpResult } from '@framework/http/ports.js'
import { IdParams, StoreCompleteCartResponse } from '@proteus/http-schemas/store'
import { completeCartWorkflow } from '@workflows/cart/complete-cart.js'

export const PostInput = { params: IdParams }
export const PostOutput = StoreCompleteCartResponse
export const PostThrows = [...completeCartWorkflow.throws] as const

export const POST = async (req: HttpRequest<typeof PostInput>): Promise<HttpResult<typeof PostOutput>> => {
  const order = await completeCartWorkflow.run({ cartId: req.params.id })

  return { status: 200, json: { orderId: order.id } }
}
