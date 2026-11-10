import { ErrorTypes } from '@core/errors/app-error.js'
import { Modules } from '@core/utils/modules-definition.js'
import type { HttpRequest, HttpResult } from '@framework/http/ports.js'
import {
  AdminCreateProductCategory,
  AdminProductCategoryResponse,
  AdminProductCategoryTreeResponse,
} from '@proteus/http-schemas/admin'

export const GetOutput = AdminProductCategoryTreeResponse

export const GET = async (req: HttpRequest): Promise<HttpResult<typeof GetOutput>> => {
  const productService = req.scope.resolve(Modules.PRODUCT)
  const productCategories = await productService.listCategoryTree()
  return { status: 200, json: { productCategories } }
}

export const PostInput = { body: AdminCreateProductCategory }
export const PostOutput = AdminProductCategoryResponse
// createCategory throws DUPLICATE_ERROR (handle taken) and NOT_FOUND (unknown parent) from the module
// ast-grep-ignore: route-declares-unthrown-error
export const PostThrows = [ErrorTypes.DUPLICATE_ERROR, ErrorTypes.NOT_FOUND] as const

export const POST = async (req: HttpRequest<typeof PostInput>): Promise<HttpResult<typeof PostOutput>> => {
  const productService = req.scope.resolve(Modules.PRODUCT)
  const productCategory = await productService.createCategory(req.body)
  return { status: 201, json: { productCategory } }
}
