import { AppError, ErrorTypes } from '@core/errors/app-error.js'
import type { ICartModuleService } from '@core/types/index.js'
import { Modules } from '@core/utils/index.js'
import { AddLineItem, IdParams, StoreCreateCartLineItemResponse } from '@proteus/http-schemas/store'
import type { HttpRequest, HttpResult } from '@server/ports.js'
import { addToCartWorkflow } from '@workflows/cart/add-to-cart.js'

export const PostInput = { params: IdParams, body: AddLineItem }
export const PostOutput = StoreCreateCartLineItemResponse

export const POST = async (req: HttpRequest<typeof PostInput>): Promise<HttpResult<typeof PostOutput>> => {
  const [lineItem] = await addToCartWorkflow.run({ cartId: req.params.id, items: [req.body] })
  if (!lineItem) {
    throw new AppError({ type: ErrorTypes.UNEXPECTED_STATE, message: 'Line item not returned after add' })
  }

  // 201 even when the addition merged into a line the cart already held: the request created
  // what it was asked to create, and a shopper adding the same variant twice has no way to know
  // which of the two it was.
  const cartService = req.scope.resolve<ICartModuleService>(Modules.CART)
  return { status: 201, json: { lineItem: cartService.enrichLineItem(lineItem) } }
}
