import { ErrorTypes } from '@core/errors/app-error.js'
import { Modules } from '@core/utils/modules-definition.js'
import type { HttpRequest, HttpResult } from '@framework/http/ports.js'
import { AdminProductCategoryResponse, AdminSetCategoryProducts, IdParams } from '@proteus/http-schemas/admin'

export const PostInput = { params: IdParams, body: AdminSetCategoryProducts }
export const PostOutput = AdminProductCategoryResponse
// setCategoryProducts throws NOT_FOUND from the module for a missing Category, and for an unknown
// product id through the mapped foreign-key violation, and NOT_ALLOWED for a ruled grouping
// ast-grep-ignore: route-declares-unthrown-error
export const PostThrows = [ErrorTypes.NOT_FOUND, ErrorTypes.NOT_ALLOWED] as const

export const POST = async (req: HttpRequest<typeof PostInput>): Promise<HttpResult<typeof PostOutput>> => {
  const productService = req.scope.resolve(Modules.PRODUCT)
  const productCategory = await productService.setCategoryProducts(req.params.id, req.body)
  return { status: 200, json: { productCategory } }
}
