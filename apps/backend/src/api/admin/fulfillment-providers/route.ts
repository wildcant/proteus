import type { IFulfillmentModuleService } from '@core/types/fulfillment/service.js'
import { Modules } from '@core/utils/modules-definition.js'
import type { HttpRequest, HttpResult } from '@framework/http/ports.js'
import { AdminFulfillmentProviderListResponse } from '@proteus/http-schemas/admin'

export const GetOutput = AdminFulfillmentProviderListResponse

export const GET = async (req: HttpRequest): Promise<HttpResult<typeof GetOutput>> => {
  const service = req.scope.resolve<IFulfillmentModuleService>(Modules.FULFILLMENT)
  const fulfillmentProviders = await service.listFulfillmentProviders()
  return { status: 200, json: { fulfillmentProviders } }
}
