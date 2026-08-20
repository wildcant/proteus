import { AppError, ErrorTypes } from '@core/errors/app-error.js'
import type { ICartModuleService, ICustomerModuleService } from '@core/types/index.js'
import { Modules } from '@core/utils/index.js'
import { CreateCart, StoreCreateCartResponse } from '@proteus/http-schemas/store'

import type { HttpRequest, HttpResult } from '../../../server/ports.js'

export const PostInput = { body: CreateCart }
export const PostOutput = StoreCreateCartResponse

export const POST = async (req: HttpRequest<typeof PostInput>): Promise<HttpResult<typeof PostOutput>> => {
  const currencyCode = req.pricingContext?.currencyCode
  if (!currencyCode) {
    throw new AppError({
      type: ErrorTypes.INVALID_DATA,
      message: 'pricingContext missing — setPricingContext middleware not applied',
    })
  }

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

  const cart = await cartService.createCart({ ...req.body, currencyCode, customerId, email })

  return { status: 201, json: { cart } }
}
