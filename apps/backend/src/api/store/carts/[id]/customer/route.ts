import { IdParams, StoreCartResponse } from '@proteus/http-schemas/store'
import { transferCartCustomerWorkflow } from '@workflows/cart/transfer-cart-customer.js'
import type { HttpRequest, HttpResult } from '../../../../../server/ports.js'

export const PostInput = { params: IdParams }
export const PostOutput = StoreCartResponse

export const POST = async (req: HttpRequest<typeof PostInput>): Promise<HttpResult<typeof PostOutput>> => {
  const customerId = req.authContext?.actorId
  if (!customerId) {
    return { status: 401, json: { message: 'Authentication required' } as never }
  }

  const cart = await transferCartCustomerWorkflow.run({
    cartId: req.params.id,
    customerId,
  })

  return { status: 200, json: { cart } }
}
