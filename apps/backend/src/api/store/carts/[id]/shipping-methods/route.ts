import type { HttpRequest, HttpResult } from '@framework/http/ports.js'
import { AddCartShippingMethod, IdParams, StoreCreateCartShippingMethodResponse } from '@proteus/http-schemas/store'
import { addShippingMethodToCartWorkflow } from '@workflows/cart/add-shipping-method-to-cart.js'

export const PostInput = { params: IdParams, body: AddCartShippingMethod }
export const PostOutput = StoreCreateCartShippingMethodResponse
export const PostThrows = [...addShippingMethodToCartWorkflow.throws] as const

/**
 * The shopper sends an option id and never a price: the workflow checks the option serves the
 * cart's address and writes the method at the price the option costs there.
 */
export const POST = async (req: HttpRequest<typeof PostInput>): Promise<HttpResult<typeof PostOutput>> => {
  const shippingMethod = await addShippingMethodToCartWorkflow.run({
    cartId: req.params.id,
    shippingOptionId: req.body.shippingOptionId,
    data: req.body.data,
  })

  return { status: 201, json: { shippingMethod } }
}
