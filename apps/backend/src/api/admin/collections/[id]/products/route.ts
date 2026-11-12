import { ErrorTypes } from '@core/errors/app-error.js'
import { Modules } from '@core/utils/modules-definition.js'
import type { HttpRequest, HttpResult } from '@framework/http/ports.js'
import { AdminProductCollectionResponse, AdminSetCollectionProducts, IdParams } from '@proteus/http-schemas/admin'

export const PostInput = { params: IdParams, body: AdminSetCollectionProducts }
export const PostOutput = AdminProductCollectionResponse
// setCollectionProducts throws NOT_FOUND from the module for a missing Collection, and for an unknown
// product id through the mapped foreign-key violation, and NOT_ALLOWED for a ruled grouping
// ast-grep-ignore: route-declares-unthrown-error
export const PostThrows = [ErrorTypes.NOT_FOUND, ErrorTypes.NOT_ALLOWED] as const

export const POST = async (req: HttpRequest<typeof PostInput>): Promise<HttpResult<typeof PostOutput>> => {
  const productService = req.scope.resolve(Modules.PRODUCT)
  const collection = await productService.setCollectionProducts(req.params.id, req.body)
  return { status: 200, json: { collection } }
}
