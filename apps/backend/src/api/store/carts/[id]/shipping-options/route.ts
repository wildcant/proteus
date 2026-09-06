import type { IFulfillmentModuleService } from '@core/types/index.js'
import { Modules } from '@core/utils/index.js'
import { IdParams, StoreShippingOptionListParams, StoreShippingOptionListResponse } from '@proteus/http-schemas/store'
import type { HttpRequest, HttpResult } from '@server/ports.js'

export const GetInput = { params: IdParams, query: StoreShippingOptionListParams }
export const GetOutput = StoreShippingOptionListResponse

export const GET = async (req: HttpRequest<typeof GetInput>): Promise<HttpResult<typeof GetOutput>> => {
  const { province, city, postalCode } = req.validatedQuery.filters
  // TODO(fulfillment): resolve country from cart's shipping address
  const countryCode = req.validatedQuery.filters.countryCode ?? 'us'

  const fulfillmentService = req.scope.resolve<IFulfillmentModuleService>(Modules.FULFILLMENT)

  const shippingOptions = await fulfillmentService.listShippingOptionsForContext({
    countryCode,
    province,
    city,
    postalCode,
  })

  return { status: 200, json: { shippingOptions } }
}
