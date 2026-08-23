import { AppError, ErrorTypes } from '@core/errors/app-error.js'
import type { ICartModuleService, IProductModuleService } from '@core/types/index.js'
import { Modules } from '@core/utils/index.js'
import { AddLineItem, IdParams, StoreCreateCartLineItemResponse } from '@proteus/http-schemas/store'
import type { HttpRequest, HttpResult } from '../../../../../server/ports.js'

export const PostInput = { params: IdParams, body: AddLineItem }
export const PostOutput = StoreCreateCartLineItemResponse

export const POST = async (req: HttpRequest<typeof PostInput>): Promise<HttpResult<typeof PostOutput>> => {
  const cartService = req.scope.resolve<ICartModuleService>(Modules.CART)
  const productService = req.scope.resolve<IProductModuleService>(Modules.PRODUCT)
  const thumbnail = req.body.variantId ? await productService.resolveVariantThumbnail(req.body.variantId) : null
  const [lineItem] = await cartService.addLineItems(req.params.id, [{ ...req.body, thumbnail }])
  if (!lineItem) {
    throw new AppError({ type: ErrorTypes.UNEXPECTED_STATE, message: 'Line item not returned after create' })
  }

  return { status: 201, json: { lineItem: cartService.enrichLineItem(lineItem) } }
}
