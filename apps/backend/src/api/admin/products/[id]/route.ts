import type { IProductModuleService } from '@core/types/index.js'
import { Modules } from '@core/utils/index.js'
import {
  AdminProductResponse,
  AdminUpdateProduct,
  AdminUpdateProductResponse,
  DeleteResponse,
  IdParams,
} from '@proteus/http-schemas/admin'
import type { HttpRequest, HttpResult } from '../../../../server/ports.js'

export const GetInput = { params: IdParams }
export const GetOutput = AdminProductResponse

export const GET = async (req: HttpRequest<typeof GetInput>): Promise<HttpResult<typeof GetOutput>> => {
  const productService = req.scope.resolve<IProductModuleService>(Modules.PRODUCT)
  const [product, options] = await Promise.all([
    productService.retrieveProduct(req.params.id),
    productService.listProductOptionsForProduct(req.params.id),
  ])
  return { status: 200, json: { product: { ...product, options } } }
}

export const PatchInput = { params: IdParams, body: AdminUpdateProduct }
export const PatchOutput = AdminUpdateProductResponse

export const PATCH = async (req: HttpRequest<typeof PatchInput>): Promise<HttpResult<typeof PatchOutput>> => {
  const productService = req.scope.resolve<IProductModuleService>(Modules.PRODUCT)
  const product = await productService.updateProduct(req.params.id, req.body)
  return { status: 200, json: { product } }
}

export const DeleteInput = { params: IdParams }
export const DeleteOutput = DeleteResponse

export const DELETE = async (req: HttpRequest<typeof DeleteInput>): Promise<HttpResult<typeof DeleteOutput>> => {
  const productService = req.scope.resolve<IProductModuleService>(Modules.PRODUCT)
  await productService.deleteProducts([req.params.id])
  return { status: 200, json: { id: req.params.id, deleted: true } }
}
