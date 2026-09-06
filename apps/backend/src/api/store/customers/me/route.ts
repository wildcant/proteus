import { AppError, ErrorTypes } from '@core/errors/app-error.js'
import type { ICustomerModuleService } from '@core/types/index.js'
import { Modules } from '@core/utils/index.js'
import { CustomerResponse } from '@proteus/http-schemas/store'
import type { HttpRequest, HttpResult } from '@server/ports.js'

export const GetOutput = CustomerResponse

export const GET = async (req: HttpRequest): Promise<HttpResult<typeof GetOutput>> => {
  const customerId = req.authContext?.actorId
  if (!customerId) {
    throw new AppError({ type: ErrorTypes.UNAUTHORIZED, message: 'Not authenticated' })
  }

  const customerService = req.scope.resolve<ICustomerModuleService>(Modules.CUSTOMER)
  const customer = await customerService.retrieveCustomer(customerId)

  return { status: 200, json: { customer } }
}
