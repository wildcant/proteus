import type { IPaymentModuleService } from '@core/types/payment/service.js'
import { Modules } from '@core/utils/index.js'
import { AdminPaymentProviderListResponse } from '@proteus/http-schemas/admin'
import type { HttpRequest, HttpResult } from '@server/ports.js'

export const GetOutput = AdminPaymentProviderListResponse

/**
 * The payment gateways a region may be given.
 *
 * Enabled only: a disabled provider is one the deployment has switched off, and offering it in the
 * region editor would let a merchant attach a gateway that fails at authorization. Region rows
 * already linked to a since-disabled provider keep it — this list is what may be *chosen*, not
 * what is in use.
 */
export const GET = async (req: HttpRequest): Promise<HttpResult<typeof GetOutput>> => {
  const paymentService = req.scope.resolve<IPaymentModuleService>(Modules.PAYMENT)
  const paymentProviders = await paymentService.listPaymentProviders({ isEnabled: true }, { order: { id: 'ASC' } })

  return { status: 200, json: { paymentProviders } }
}
