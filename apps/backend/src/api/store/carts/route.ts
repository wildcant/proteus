import type { ICartModuleService, ICustomerModuleService } from '@core/types/index.js'
import { Modules } from '@core/utils/index.js'
import { CreateCart, StoreCreateCartResponse, StorePricingContextParams } from '@proteus/http-schemas/store'
import type { HttpRequest, HttpResult } from '@server/ports.js'
import { addToCartWorkflow } from '@workflows/cart/add-to-cart.js'
import { setPricingContext } from '../middlewares.js'

export const PostInput = { body: CreateCart, contextQuery: StorePricingContextParams }
export const PostMiddlewares = [setPricingContext()] as const
export const PostOutput = StoreCreateCartResponse
export const PostThrows = [...addToCartWorkflow.throws] as const

export const POST = async (
  req: HttpRequest<typeof PostInput, typeof PostMiddlewares>,
): Promise<HttpResult<typeof PostOutput>> => {
  const { currencyCode, regionId } = req.pricingContext

  const cartService = req.scope.resolve<ICartModuleService>(Modules.CART)
  const customerId = req.authContext?.actorId

  // TODO(guest): move to a createCartWorkflow with a findOrCreateCustomerStep
  // so guest emails also resolve to a customer record
  let email: string | undefined
  if (customerId) {
    const customerService = req.scope.resolve<ICustomerModuleService>(Modules.CUSTOMER)
    const customer = await customerService.retrieveCustomer(customerId)
    email = customer.email
  }

  const { items, ...body } = req.body
  // The region is stamped on the cart, not just its currency: it is what later requests read back
  // when the shopper returns without a country segment, and what a repricing slice will compare
  // against to decide the cart has changed market.
  const cart = await cartService.createCart({
    ...body,
    currencyCode,
    regionId,
    customerId,
    email,
  })

  // Through the workflow rather than straight into `createCart`, so a cart born with items is
  // priced and merged by the same rules as one filled a click at a time.
  if (items?.length) {
    await addToCartWorkflow.run({ cartId: cart.id, items })
  }

  return { status: 201, json: { cart } }
}
