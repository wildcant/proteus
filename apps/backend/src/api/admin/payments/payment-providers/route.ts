import type { IPaymentModuleService } from '@core/types/index.js'
import { Modules } from '@core/utils/index.js'
import type { HttpRequest, HttpResult } from '@framework/http/ports.js'
import { AdminPaymentProviderListResponse } from '@proteus/http-schemas/admin'

export const GetOutput = AdminPaymentProviderListResponse

export const GET = async (req: HttpRequest): Promise<HttpResult<typeof GetOutput>> => {
  const paymentService = req.scope.resolve<IPaymentModuleService>(Modules.PAYMENT)
  const providers = await paymentService.listPaymentProviders()

  return { status: 200, json: { paymentProviders: providers } }
}
