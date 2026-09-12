import { AppError, ErrorTypes } from '@core/errors/app-error.js'
import type { HttpRequest, HttpResult } from '@framework/http/ports.js'
import { IdParams, StoreCartResponse } from '@proteus/http-schemas/store'
import { transferCartCustomerWorkflow } from '@workflows/cart/transfer-cart-customer.js'

export const PostInput = { params: IdParams }
export const PostOutput = StoreCartResponse
export const PostThrows = [ErrorTypes.UNAUTHORIZED, ...transferCartCustomerWorkflow.throws] as const

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
