import { Modules } from '@core/utils/modules-definition.js'
import type { HttpRequest, HttpResult } from '@framework/http/ports.js'
import { AdminProductImportResponse, IdParams } from '@proteus/http-schemas/admin'

export const GetInput = { params: IdParams }
export const GetOutput = AdminProductImportResponse

export const GET = async (req: HttpRequest<typeof GetInput>): Promise<HttpResult<typeof GetOutput>> => {
  const productService = req.scope.resolve(Modules.PRODUCT)
  const productImport = await productService.retrieveProductImport(req.params.id)
  return { status: 200, json: { productImport } }
}
