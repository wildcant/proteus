import type { IProductModuleService } from '@core/types/index.js'
import { Modules } from '@core/utils/index.js'
import { AdminSetProductOptions, AdminSetProductOptionsResponse, IdParams } from '@proteus/http-schemas/admin'
import { setProductOptionsWorkflow } from '@workflows/product/set-product-options.js'
import type { HttpRequest, HttpResult } from '../../../../../server/ports.js'

export const GetInput = { params: IdParams }
export const GetOutput = AdminSetProductOptionsResponse

export const GET = async (req: HttpRequest<typeof GetInput>): Promise<HttpResult<typeof GetOutput>> => {
  const productService = req.scope.resolve<IProductModuleService>(Modules.PRODUCT)
  return { status: 200, json: { productOptions: await productService.listProductScopedOptions(req.params.id) } }
}

export const PutInput = { params: IdParams, body: AdminSetProductOptions }
export const PutOutput = AdminSetProductOptionsResponse

export const PUT = async (req: HttpRequest<typeof PutInput>): Promise<HttpResult<typeof PutOutput>> => {
  const productService = req.scope.resolve<IProductModuleService>(Modules.PRODUCT)
  // The workflow, not the service: changing the options reconciles the product's variants with
  // them, and that reaches into pricing, links and carts.
  await setProductOptionsWorkflow.run({ productId: req.params.id, data: req.body })
  return { status: 200, json: { productOptions: await productService.listProductScopedOptions(req.params.id) } }
}
