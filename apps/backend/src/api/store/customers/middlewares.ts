import { AppError, ErrorTypes } from '@core/errors/app-error.js'
import type { ICustomerModuleService } from '@core/types/index.js'
import { Modules } from '@core/utils/index.js'
import type { MiddlewareFunction } from '@framework/http/types.js'

/**
 * Refuses an address the authenticated customer does not own.
 *
 * `/store/customers/me/addresses/:id` reads as if it could only ever reach the caller's own rows,
 * but the id in the path is whatever was typed — without this, a PATCH edits a stranger's address.
 *
 * 404 rather than the cart's FORBIDDEN, matching `GET /store/orders/:id`: a customer probing ids
 * learns nothing about which of them exist. The cart can afford to be plainer because a cart with
 * no customer is legitimately shared; an address always belongs to exactly one.
 */
export function validateAddressOwnership(): MiddlewareFunction {
  return async (req) => {
    // Middlewares run before `input.params` is validated, so the id is still unknown here.
    const addressId = req.params.id as string | undefined
    if (!addressId) return req

    const customerService = req.scope.resolve<ICustomerModuleService>(Modules.CUSTOMER)
    const [address] = await customerService.listCustomerAddresses({ id: addressId })

    if (!address || address.customerId !== req.authContext?.actorId) {
      throw new AppError({ type: ErrorTypes.NOT_FOUND, message: `Address with id "${addressId}" not found` })
    }

    return req
  }
}
