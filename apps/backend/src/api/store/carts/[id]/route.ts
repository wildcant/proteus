import type { ICartModuleService } from '@core/types/index.js'
import { Modules } from '@core/utils/index.js'
import { IdParams, StoreCartDetailResponse, StoreUpdateCartResponse, UpdateCart } from '@proteus/http-schemas/store'
import type { HttpRequest, HttpResult } from '@server/ports.js'
import { updateCartWorkflow } from '@workflows/cart/update-cart.js'

export const GetInput = { params: IdParams }
export const GetOutput = StoreCartDetailResponse

export const GET = async (req: HttpRequest<typeof GetInput>): Promise<HttpResult<typeof GetOutput>> => {
  const cartService = req.scope.resolve<ICartModuleService>(Modules.CART)

  const [cart, lineItems, shippingMethods, addresses] = await Promise.all([
    cartService.retrieveCart(req.params.id),
    cartService.listLineItems({ cartId: req.params.id }),
    cartService.listShippingMethods({ cartId: req.params.id }),
    cartService.listCartAddresses({ cartId: req.params.id }),
  ])

  const shippingAddress = addresses.find((address) => address.type === 'shipping') ?? null
  const billingAddress = addresses.find((address) => address.type === 'billing') ?? null

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
