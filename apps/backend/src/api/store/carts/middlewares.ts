import { AppError, ErrorTypes } from '@core/errors/app-error.js'
import type { ICartModuleService, ICustomerModuleService } from '@core/types/index.js'
import { Modules } from '@core/utils/index.js'
import type { MiddlewareFunction } from '@framework/http/types.js'

export function validateCartOwnership(): MiddlewareFunction {
  return async (req) => {
    const cartId = req.params.id as string | undefined
    if (!cartId) return req

    const actorId = req.authContext?.actorId

    const cartService = req.scope.resolve<ICartModuleService>(Modules.CART)
    const cart = await cartService.retrieveCart(cartId)

    // Fast path: owner is the authenticated user
    if (cart.customerId && cart.customerId === actorId) {
      return req
    }

    // Cart has no customer — allow anyone
    if (!cart.customerId) {
      return req
    }

    // Cart belongs to a customer — check if it's a guest customer
    const customerService = req.scope.resolve<ICustomerModuleService>(Modules.CUSTOMER)
    const customer = await customerService.retrieveCustomer(cart.customerId)

    if (!customer.hasAccount) {
      return req
    }

    // Registered customer's cart — only the owner can access it
    throw new AppError({
      type: ErrorTypes.FORBIDDEN,
      message: `Cart with id "${cartId}" not found`,
    })
  }
}
