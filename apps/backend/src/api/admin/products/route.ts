import type { IProductModuleService } from '@core/types/index.js'
import { Modules } from '@core/utils/index.js'
import {
  AdminCreateProduct,
  AdminCreateProductResponse,
  AdminProductListParams,
  AdminProductListResponse,
} from '@proteus/http-schemas/admin'
import { createProductWorkflow } from '@workflows/product/create-product.js'
import type { HttpRequest, HttpResult } from '../../../server/ports.js'

export const GetInput = { query: AdminProductListParams }
export const GetOutput = AdminProductListResponse

export const GET = async (req: HttpRequest<typeof GetInput>): Promise<HttpResult<typeof GetOutput>> => {
  const productService = req.scope.resolve<IProductModuleService>(Modules.PRODUCT)
  const { pagination, filters } = req.validatedQuery
  const [products, count] = await productService.listAndCountProducts(filters, pagination)
  const { offset, limit } = pagination
  return { status: 200, json: { products, count, offset, limit } }
}

export const PostInput = { body: AdminCreateProduct }
export const PostOutput = AdminCreateProductResponse

export const POST = async (req: HttpRequest<typeof PostInput>): Promise<HttpResult<typeof PostOutput>> => {
  const { options, variants, ...productData } = req.body
  const product = await createProductWorkflow.run({ product: productData, options, variants })
  return { status: 201, json: { product } }
}
