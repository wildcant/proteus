import { ErrorTypes } from '@core/errors/app-error.js'
import { Modules } from '@core/utils/modules-definition.js'
import type { HttpRequest, HttpResult } from '@framework/http/ports.js'
import {
  DeleteResponse,
  LineIdParams,
  StoreUpdateCartLineItemResponse,
  UpdateLineItem,
} from '@proteus/http-schemas/store'
import { updateLineItemWorkflow } from '@workflows/cart/update-line-item.js'
import { attachLineItemStock } from '../../../middlewares.js'

export const PostInput = { params: LineIdParams, body: UpdateLineItem }
export const PostMiddlewares = [attachLineItemStock()] as const
export const PostOutput = StoreUpdateCartLineItemResponse
export const PostThrows = [...updateLineItemWorkflow.throws] as const

export const POST = async (
  req: HttpRequest<typeof PostInput, typeof PostMiddlewares>,
): Promise<HttpResult<typeof PostOutput>> => {
  const lineItem = await updateLineItemWorkflow.run({
    cartId: req.params.id,
    lineItemId: req.params.lineId,
    quantity: req.body.quantity,
  })

  const cartService = req.scope.resolve(Modules.CART)
  const stockOf = await req.lineItemStock([lineItem])

  return { status: 200, json: { lineItem: { ...cartService.enrichLineItem(lineItem), ...stockOf(lineItem) } } }
}

export const DeleteInput = { params: LineIdParams }
export const DeleteOutput = DeleteResponse
// removeLineItem throws NOT_FOUND (no such cart, or a line the cart does not hold) and NOT_ALLOWED
// (a completed cart) from the cart module
// ast-grep-ignore: route-declares-unthrown-error
export const DeleteThrows = [ErrorTypes.NOT_FOUND, ErrorTypes.NOT_ALLOWED] as const

export const DELETE = async (req: HttpRequest<typeof DeleteInput>): Promise<HttpResult<typeof DeleteOutput>> => {
  const cartService = req.scope.resolve(Modules.CART)
  await cartService.removeLineItem(req.params.id, req.params.lineId)

  return { status: 200, json: { id: req.params.lineId, deleted: true } }
}
