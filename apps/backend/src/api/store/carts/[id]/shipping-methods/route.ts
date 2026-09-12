import { BigNumber } from '@core/bignumber.js'
import { AppError, ErrorTypes } from '@core/errors/app-error.js'
import type { ICartModuleService, IFulfillmentModuleService } from '@core/types/index.js'
import { Modules } from '@core/utils/index.js'
import type { HttpRequest, HttpResult } from '@framework/http/ports.js'
import { AddCartShippingMethod, IdParams, StoreCreateCartShippingMethodResponse } from '@proteus/http-schemas/store'

export const PostInput = { params: IdParams, body: AddCartShippingMethod }
export const PostOutput = StoreCreateCartShippingMethodResponse
export const PostThrows = [ErrorTypes.NOT_ALLOWED] as const

export const POST = async (req: HttpRequest<typeof PostInput>): Promise<HttpResult<typeof PostOutput>> => {
  const cartService = req.scope.resolve<ICartModuleService>(Modules.CART)
  const fulfillmentService = req.scope.resolve<IFulfillmentModuleService>(Modules.FULFILLMENT)

  // The option carries the name and the amount the cart's method is written with — the shopper
  // sends an id, never a price.
  const shippingOption = await fulfillmentService.retrieveShippingOption(req.body.shippingOptionId)

  if (!shippingOption.isEnabled) {
    throw new AppError({
      type: ErrorTypes.NOT_ALLOWED,
      message: `Shipping option "${req.body.shippingOptionId}" is not available`,
    })
  }

  const shippingMethod = await cartService.setShippingMethod(req.params.id, {
    name: shippingOption.name,
    amount: new BigNumber(shippingOption.amount ?? 0),
    shippingOptionId: shippingOption.id,
    data: req.body.data ?? null,
  })

  return { status: 201, json: { shippingMethod } }
}
