import { AppError, ErrorTypes } from '@core/errors/app-error.js'
import { IdParams, StoreCartResponse } from '@proteus/http-schemas/store'
import type { HttpRequest, HttpResult } from '@server/ports.js'
import { transferCartCustomerWorkflow } from '@workflows/cart/transfer-cart-customer.js'

export const PostInput = { params: IdParams }
export const PostOutput = StoreCartResponse

export const POST = async (req: HttpRequest<typeof PostInput>): Promise<HttpResult<typeof PostOutput>> => {
  const customerId = req.authContext?.actorId
  if (!customerId) {
    throw new AppError({ type: ErrorTypes.UNAUTHORIZED, message: 'Authentication required' })
  }

  const cart = await transferCartCustomerWorkflow.run({
    cartId: req.params.id,
    customerId,
  })

  return { status: 200, json: { cart } }
}
