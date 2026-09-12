import { AppError, ErrorTypes } from '@core/errors/app-error.js'
import type { ICustomerModuleService } from '@core/types/index.js'
import { Modules } from '@core/utils/index.js'
import type { HttpRequest, HttpResult } from '@framework/http/ports.js'
import { DeleteResponse, IdParams, StoreCustomerAddressResponse, StoreUpdateAddress } from '@proteus/http-schemas/store'
import { validateAddressOwnership } from '../../../middlewares.js'

export const PatchInput = { params: IdParams, body: StoreUpdateAddress }
export const PatchMiddlewares = [validateAddressOwnership()] as const
export const PatchOutput = StoreCustomerAddressResponse
export const PatchThrows = [ErrorTypes.UNAUTHORIZED] as const

export const PATCH = async (
  req: HttpRequest<typeof PatchInput, typeof PatchMiddlewares>,
): Promise<HttpResult<typeof PatchOutput>> => {
  // `validateAddressOwnership()` has already refused an address belonging to someone else; this
  // is the caller with no session at all, which it has nothing to compare against.
  if (!req.authContext?.actorId) {
    throw new AppError({ type: ErrorTypes.UNAUTHORIZED, message: 'Not authenticated' })
  }

  const customerService = req.scope.resolve<ICustomerModuleService>(Modules.CUSTOMER)
  const { isDefault, ...fields } = req.body

  // Releasing the flags is a plain field change; only claiming them contends with the partial
  // unique indexes, which is what `makeDefault` exists for.
  const changes = isDefault === false ? { ...fields, isDefaultShipping: false, isDefaultBilling: false } : fields

  const address = await customerService.updateCustomerAddress(req.params.id, changes, { makeDefault: isDefault })
  return { status: 200, json: { address } }
}

export const DeleteInput = { params: IdParams }
export const DeleteMiddlewares = [validateAddressOwnership()] as const
export const DeleteOutput = DeleteResponse

export const DELETE = async (
  req: HttpRequest<typeof DeleteInput, typeof DeleteMiddlewares>,
): Promise<HttpResult<typeof DeleteOutput>> => {
  const customerService = req.scope.resolve<ICustomerModuleService>(Modules.CUSTOMER)
  await customerService.softDeleteCustomerAddresses([req.params.id])

  return { status: 200, json: { id: req.params.id, deleted: true } }
}
