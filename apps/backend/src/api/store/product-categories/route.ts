import { Modules } from '@core/utils/modules-definition.js'
import type { HttpRequest, HttpResult } from '@framework/http/ports.js'
import { StoreProductCategoryTreeResponse } from '@proteus/http-schemas/store'

export const GetOutput = StoreProductCategoryTreeResponse

export const GET = async (req: HttpRequest): Promise<HttpResult<typeof GetOutput>> => {
  const productService = req.scope.resolve(Modules.PRODUCT)
  const productCategories = await productService.listCategoryTree({ visibleOnly: true })
  return { status: 200, json: { productCategories } }
}
