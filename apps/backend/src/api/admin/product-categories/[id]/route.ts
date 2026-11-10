import { ErrorTypes } from '@core/errors/app-error.js'
import { Modules } from '@core/utils/modules-definition.js'
import type { HttpRequest, HttpResult } from '@framework/http/ports.js'
import {
  AdminProductCategoryResponse,
  AdminUpdateProductCategory,
  DeleteResponse,
  IdParams,
} from '@proteus/http-schemas/admin'

export const GetInput = { params: IdParams }
export const GetOutput = AdminProductCategoryResponse
// retrieveCategory throws NOT_FOUND from the module when the Category does not exist
// ast-grep-ignore: route-declares-unthrown-error
export const GetThrows = [ErrorTypes.NOT_FOUND] as const

export const GET = async (req: HttpRequest<typeof GetInput>): Promise<HttpResult<typeof GetOutput>> => {
  const productService = req.scope.resolve(Modules.PRODUCT)
  const productCategory = await productService.retrieveCategory(req.params.id)
  return { status: 200, json: { productCategory } }
}

export const PatchInput = { params: IdParams, body: AdminUpdateProductCategory }
export const PatchOutput = AdminProductCategoryResponse
// updateCategory throws NOT_FOUND (missing Category) and DUPLICATE_ERROR (handle taken) from the module
// ast-grep-ignore: route-declares-unthrown-error
export const PatchThrows = [ErrorTypes.NOT_FOUND, ErrorTypes.DUPLICATE_ERROR] as const

export const PATCH = async (req: HttpRequest<typeof PatchInput>): Promise<HttpResult<typeof PatchOutput>> => {
  const productService = req.scope.resolve(Modules.PRODUCT)
  const productCategory = await productService.updateCategory(req.params.id, req.body)
  return { status: 200, json: { productCategory } }
}

export const DeleteInput = { params: IdParams }
export const DeleteOutput = DeleteResponse
// the soft-delete cascade throws NOT_ALLOWED while the Category still has live children
// ast-grep-ignore: route-declares-unthrown-error
export const DeleteThrows = [ErrorTypes.NOT_ALLOWED] as const

export const DELETE = async (req: HttpRequest<typeof DeleteInput>): Promise<HttpResult<typeof DeleteOutput>> => {
  const productService = req.scope.resolve(Modules.PRODUCT)
  await productService.softDeleteCategories([req.params.id])
  return { status: 200, json: { id: req.params.id, deleted: true } }
}
