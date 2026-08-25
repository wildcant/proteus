import { AppError, ErrorTypes } from '@core/errors/app-error.js'
import type { ICustomerModuleService } from '@core/types/index.js'
import { Modules } from '@core/utils/index.js'
import { DeleteResponse, IdParams, StoreCustomerAddressResponse, StoreUpdateAddress } from '@proteus/http-schemas/store'
import type { HttpRequest, HttpResult } from '../../../../../../server/ports.js'

export const PatchInput = { params: IdParams, body: StoreUpdateAddress }
export const PatchOutput = StoreCustomerAddressResponse

// Ownership is enforced by `validateAddressOwnership` in the route definition, so by the time a
// handler here runs the id in the path is known to be one of the caller's own.
export const PATCH = async (req: HttpRequest<typeof PatchInput>): Promise<HttpResult<typeof PatchOutput>> => {
  const customerId = req.authContext?.actorId
  if (!customerId) {
    throw new AppError({ type: ErrorTypes.UNAUTHORIZED, message: 'Not authenticated' })
  }

  const customerService = req.scope.resolve<ICustomerModuleService>(Modules.CUSTOMER)
  const { isDefault, ...fields } = req.body

  // Releasing the flags is a plain update; only claiming them contends with the partial unique
  // indexes, which is what setDefaultAddress exists for.
  const changes = isDefault === false ? { ...fields, isDefaultShipping: false, isDefaultBilling: false } : fields

  if (!isDefault) {
    const address = await customerService.updateCustomerAddress(req.params.id, changes)
    return { status: 200, json: { address } }
  }

  // A promotion on its own carries no field changes, and drizzle refuses an empty `set`.
  if (Object.keys(changes).length > 0) {
    await customerService.updateCustomerAddress(req.params.id, changes)
  }

  const address = await customerService.setDefaultAddress(customerId, req.params.id)
  return { status: 200, json: { address } }
}

export const DeleteInput = { params: IdParams }
export const DeleteOutput = DeleteResponse

export const DELETE = async (req: HttpRequest<typeof DeleteInput>): Promise<HttpResult<typeof DeleteOutput>> => {
  const customerService = req.scope.resolve<ICustomerModuleService>(Modules.CUSTOMER)
  await customerService.softDeleteCustomerAddresses([req.params.id])

  return { status: 200, json: { id: req.params.id, deleted: true } }
}
