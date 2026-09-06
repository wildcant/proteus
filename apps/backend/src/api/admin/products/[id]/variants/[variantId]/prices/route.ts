import type { IProductModuleService } from '@core/types/index.js'
import { Modules } from '@core/utils/index.js'
import {
  AdminUpdateVariantPrices,
  AdminUpdateVariantPricesResponse,
  VariantIdParams,
} from '@proteus/http-schemas/admin'
import type { HttpRequest, HttpResult } from '@server/ports.js'
import { updateVariantPricesWorkflow } from '@workflows/product/update-variant-prices.js'

export const PutInput = { params: VariantIdParams, body: AdminUpdateVariantPrices }
export const PutOutput = AdminUpdateVariantPricesResponse

export const PUT = async (req: HttpRequest<typeof PutInput>): Promise<HttpResult<typeof PutOutput>> => {
  const productService = req.scope.resolve<IProductModuleService>(Modules.PRODUCT)
  const updated = await updateVariantPricesWorkflow.run({ variantId: req.params.variantId, data: req.body })
  const variant = await productService.enrichVariant(updated)

  return { status: 200, json: { variant } }
}
