import { BigNumber } from '@core/bignumber.js'
import { AppError, ErrorTypes } from '@core/errors/app-error.js'
import { Modules } from '@core/utils/modules-definition.js'
import type { HttpRequest, HttpResult } from '@framework/http/ports.js'
import { AddCartShippingMethod, IdParams, StoreCreateCartShippingMethodResponse } from '@proteus/http-schemas/store'
import { i18n } from '@proteus/utils'

export const PostInput = { params: IdParams, body: AddCartShippingMethod }
export const PostOutput = StoreCreateCartShippingMethodResponse
export const PostThrows = [ErrorTypes.NOT_ALLOWED] as const

export const POST = async (req: HttpRequest<typeof PostInput>): Promise<HttpResult<typeof PostOutput>> => {
  const cartService = req.scope.resolve(Modules.CART)
  const fulfillmentService = req.scope.resolve(Modules.FULFILLMENT)

  // The option carries the name and the amount the cart's method is written with — the shopper
  // sends an id, never a price.
  const shippingOption = await fulfillmentService.retrieveShippingOption(req.body.shippingOptionId)

  if (!shippingOption.isEnabled) {
    throw new AppError({
      type: ErrorTypes.NOT_ALLOWED,
      message: i18n.t('Shipping option "{shippingOptionId}" is not available'),
      values: { shippingOptionId: req.body.shippingOptionId },
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
