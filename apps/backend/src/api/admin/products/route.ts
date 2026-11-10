import { ErrorTypes } from '@core/errors/app-error.js'
import { Modules } from '@core/utils/modules-definition.js'
import type { HttpRequest, HttpResult } from '@framework/http/ports.js'
import {
  AdminCreateProduct,
  AdminCreateProductResponse,
  AdminProductListParams,
  AdminProductListResponse,
} from '@proteus/http-schemas/admin'
import { createProductWorkflow } from '@workflows/product/create-product.js'

export const GetInput = { query: AdminProductListParams }
export const GetOutput = AdminProductListResponse

export const GET = async (req: HttpRequest<typeof GetInput>): Promise<HttpResult<typeof GetOutput>> => {
  const productService = req.scope.resolve(Modules.PRODUCT)
  const { pagination, filters } = req.validatedQuery
  const [products, count] = await productService.listAndCountProducts(filters, pagination)
  const { offset, limit } = pagination
  return { status: 200, json: { products, count, offset, limit } }
}

export const PostInput = { body: AdminCreateProduct }
export const PostOutput = AdminCreateProductResponse
// an unknown id in `categoryIds`, `collectionIds`, `tagIds` or `typeId` is a foreign-key violation the module
// maps to NOT_FOUND
// ast-grep-ignore: route-declares-unthrown-error
export const PostThrows = [...createProductWorkflow.throws, ErrorTypes.NOT_FOUND] as const

export const POST = async (req: HttpRequest<typeof PostInput>): Promise<HttpResult<typeof PostOutput>> => {
  const productService = req.scope.resolve(Modules.PRODUCT)
  const { options, variants, ...productData } = req.body
  const product = await createProductWorkflow.run({ product: productData, options, variants })
  const groupings = await productService.listProductGroupings([product.id])
  const { type = null, categories = [], collections = [], tags = [] } = groupings[product.id] ?? {}
  return { status: 201, json: { product: { ...product, type, categories, collections, tags } } }
}
