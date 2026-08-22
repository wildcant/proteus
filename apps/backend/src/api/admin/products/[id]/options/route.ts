import type { IProductModuleService } from '@core/types/index.js'
import { Modules } from '@core/utils/index.js'
import { AdminSetProductOptions, AdminSetProductOptionsResponse, IdParams } from '@proteus/http-schemas/admin'
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
  await productService.setProductOptions(req.params.id, req.body)
  return { status: 200, json: { productOptions: await productService.listProductScopedOptions(req.params.id) } }
}
