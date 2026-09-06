import { AppError, ErrorTypes } from '@core/errors/app-error.js'
import type { ICustomerModuleService } from '@core/types/index.js'
import { Modules } from '@core/utils/index.js'
import {
  StoreCreateAddress,
  StoreCustomerAddressListResponse,
  StoreCustomerAddressResponse,
} from '@proteus/http-schemas/store'
import type { HttpRequest, HttpResult } from '@server/ports.js'

export const GetOutput = StoreCustomerAddressListResponse

export const GET = async (req: HttpRequest): Promise<HttpResult<typeof GetOutput>> => {
  const customerId = req.authContext?.actorId
  if (!customerId) {
    throw new AppError({ type: ErrorTypes.UNAUTHORIZED, message: 'Not authenticated' })
  }

  const customerService = req.scope.resolve<ICustomerModuleService>(Modules.CUSTOMER)
  const addresses = await customerService.listCustomerAddresses({ customerId }, { order: { createdAt: 'DESC' } })

  return { status: 200, json: { addresses } }
}

export const PostInput = { body: StoreCreateAddress }
export const PostOutput = StoreCustomerAddressResponse

export const POST = async (req: HttpRequest<typeof PostInput>): Promise<HttpResult<typeof PostOutput>> => {
  const customerId = req.authContext?.actorId
  if (!customerId) {
    throw new AppError({ type: ErrorTypes.UNAUTHORIZED, message: 'Not authenticated' })
  }

  const customerService = req.scope.resolve<ICustomerModuleService>(Modules.CUSTOMER)
  const { isDefault, ...data } = req.body

  const address = await customerService.createCustomerAddress({ ...data, customerId })
  if (!isDefault) {
    return { status: 201, json: { address } }
  }

  // Promotion is its own transactional step because the previous default has to be released
  // before this one can claim the slot. See CustomerModuleService.setDefaultAddress.
  const promoted = await customerService.setDefaultAddress(customerId, address.id)
  return { status: 201, json: { address: promoted } }
}
