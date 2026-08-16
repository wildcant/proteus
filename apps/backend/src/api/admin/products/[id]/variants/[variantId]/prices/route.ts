import {
  AdminUpdateVariantPrices,
  AdminUpdateVariantPricesResponse,
  VariantIdParams,
} from '@proteus/http-schemas/admin'
import { updateVariantPricesWorkflow } from '@workflows/product/update-variant-prices.js'
import type { HttpRequest, HttpResult } from '../../../../../../../server/ports.js'

export const PutInput = { params: VariantIdParams, body: AdminUpdateVariantPrices }
export const PutOutput = AdminUpdateVariantPricesResponse

export const PUT = async (req: HttpRequest<typeof PutInput>): Promise<HttpResult<typeof PutOutput>> => {
  const variant = await updateVariantPricesWorkflow.run({ variantId: req.params.variantId, data: req.body })
  return { status: 200, json: { variant } }
}
