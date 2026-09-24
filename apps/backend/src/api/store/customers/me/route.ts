import { AppError, ErrorTypes } from '@core/errors/app-error.js'
import { Modules } from '@core/utils/modules-definition.js'
import type { HttpRequest, HttpResult } from '@framework/http/ports.js'
import { CustomerResponse } from '@proteus/http-schemas/store'
import { i18n } from '@proteus/utils'

export const GetOutput = CustomerResponse
export const GetThrows = [ErrorTypes.UNAUTHORIZED] as const

export const GET = async (req: HttpRequest): Promise<HttpResult<typeof GetOutput>> => {
  const customerId = req.authContext?.actorId
  if (!customerId) {
    throw new AppError({ type: ErrorTypes.UNAUTHORIZED, message: i18n.t('Not authenticated') })
  }

  const customerService = req.scope.resolve(Modules.CUSTOMER)
  const customer = await customerService.retrieveCustomer(customerId)

  return { status: 200, json: { customer } }
}
