import type { IPaymentModuleService } from '@core/types/index.js'
import { Modules } from '@core/utils/index.js'
import { env } from '@env'
import { StorePaymentProviderListResponse } from '@proteus/http-schemas/store'
import type { HttpRequest, HttpResult } from '@server/ports.js'

export const GetOutput = StorePaymentProviderListResponse

export const GET = async (req: HttpRequest): Promise<HttpResult<typeof GetOutput>> => {
  const paymentService = req.scope.resolve<IPaymentModuleService>(Modules.PAYMENT)
  const providers = await paymentService.listPaymentProviders({ isEnabled: true })

  const paymentProviders = providers
    .map((provider) => ({
      ...provider,
      ...paymentService.getProviderMeta(provider.id),
    }))
    .filter((provider) => !(env.NODE_ENV === 'production' && provider.isTestOnly))

  return { status: 200, json: { paymentProviders } }
}
