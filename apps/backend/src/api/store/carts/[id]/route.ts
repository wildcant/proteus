import type { ICartModuleService } from '@core/types/index.js'
import { Modules } from '@core/utils/index.js'
import { IdParams, StoreCartDetailResponse, StoreUpdateCartResponse, UpdateCart } from '@proteus/http-schemas/store'
import { updateCartWorkflow } from '@workflows/cart/update-cart.js'
import type { HttpRequest, HttpResult } from '../../../../server/ports.js'

export const GetInput = { params: IdParams }
export const GetOutput = StoreCartDetailResponse

export const GET = async (req: HttpRequest<typeof GetInput>): Promise<HttpResult<typeof GetOutput>> => {
  const cartService = req.scope.resolve<ICartModuleService>(Modules.CART)

  const [cart, lineItems, shippingMethods] = await Promise.all([
    cartService.retrieveCart(req.params.id),
    cartService.listLineItems({ cartId: req.params.id }),
    cartService.listShippingMethods({ cartId: req.params.id }),
  ])

  const [shippingAddress, billingAddress] = await Promise.all([
    cart.shippingAddressId ? cartService.retrieveCartAddress(cart.shippingAddressId) : null,
    cart.billingAddressId ? cartService.retrieveCartAddress(cart.billingAddressId) : null,
  ])

  const totals = cartService.computeCartTotals({ lineItems, shippingMethods })
  const enrichedItems = cartService.enrichLineItems(lineItems)

  return {
    status: 200,
    json: { cart: { ...cart, items: enrichedItems, shippingMethods, totals, shippingAddress, billingAddress } },
  }
}

export const PostInput = { params: IdParams, body: UpdateCart }
export const PostOutput = StoreUpdateCartResponse

export const POST = async (req: HttpRequest<typeof PostInput>): Promise<HttpResult<typeof PostOutput>> => {
  const cart = await updateCartWorkflow.run({ cartId: req.params.id, ...req.body })

  return { status: 200, json: { cart } }
}
