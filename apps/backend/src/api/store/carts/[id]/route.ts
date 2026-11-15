import { Modules } from '@core/utils/modules-definition.js'
import type { HttpRequest, HttpResult } from '@framework/http/ports.js'
import { IdParams, StoreCartDetailResponse, StoreUpdateCartResponse, UpdateCart } from '@proteus/http-schemas/store'
import { updateCartWorkflow } from '@workflows/cart/update-cart.js'
import { attachLineItemStock } from '../middlewares.js'

export const GetInput = { params: IdParams }
export const GetMiddlewares = [attachLineItemStock()] as const
export const GetOutput = StoreCartDetailResponse

export const GET = async (
  req: HttpRequest<typeof GetInput, typeof GetMiddlewares>,
): Promise<HttpResult<typeof GetOutput>> => {
  const cartService = req.scope.resolve(Modules.CART)

  const [cart, lineItems, shippingMethods, addresses] = await Promise.all([
    cartService.retrieveCart(req.params.id),
    cartService.listLineItems({ cartId: req.params.id }),
    cartService.listShippingMethods({ cartId: req.params.id }),
    cartService.listCartAddresses({ cartId: req.params.id }),
  ])

  const shippingAddress = addresses.find((address) => address.type === 'shipping') ?? null
  const billingAddress = addresses.find((address) => address.type === 'billing') ?? null

  const stockOf = await req.lineItemStock(lineItems)

  const totals = cartService.computeCartTotals({ lineItems, shippingMethods })
  const enrichedItems = cartService
    .enrichLineItems(lineItems)
    .map((lineItem) => ({ ...lineItem, ...stockOf(lineItem) }))

  return {
    status: 200,
    json: { cart: { ...cart, items: enrichedItems, shippingMethods, totals, shippingAddress, billingAddress } },
  }
}

export const PostInput = { params: IdParams, body: UpdateCart }
export const PostOutput = StoreUpdateCartResponse
export const PostThrows = [...updateCartWorkflow.throws] as const

export const POST = async (req: HttpRequest<typeof PostInput>): Promise<HttpResult<typeof PostOutput>> => {
  const cart = await updateCartWorkflow.run({ cartId: req.params.id, ...req.body })

  return { status: 200, json: { cart } }
}
