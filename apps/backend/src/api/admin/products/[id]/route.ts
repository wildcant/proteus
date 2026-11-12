import { ErrorTypes } from '@core/errors/app-error.js'
import { Modules } from '@core/utils/modules-definition.js'
import type { HttpRequest, HttpResult } from '@framework/http/ports.js'
import {
  AdminProductResponse,
  AdminUpdateProduct,
  AdminUpdateProductResponse,
  DeleteResponse,
  IdParams,
} from '@proteus/http-schemas/admin'

export const GetInput = { params: IdParams }
export const GetOutput = AdminProductResponse

export const GET = async (req: HttpRequest<typeof GetInput>): Promise<HttpResult<typeof GetOutput>> => {
  const productService = req.scope.resolve(Modules.PRODUCT)
  const [product, options, images, groupings, metafields] = await Promise.all([
    productService.retrieveProduct(req.params.id),
    productService.listProductScopedOptions(req.params.id),
    productService.listProductImages({ productId: req.params.id }, { order: { rank: 'ASC' } }),
    productService.retrieveProductGroupings(req.params.id),
    productService.retrieveProductMetafields(req.params.id),
  ])
  return { status: 200, json: { product: { ...product, ...groupings, metafields, options, images } } }
}

export const PatchInput = { params: IdParams, body: AdminUpdateProduct }
export const PatchOutput = AdminUpdateProductResponse
// updateProduct throws NOT_FOUND from the module for a missing product, and for an unknown id in
// `categoryIds`, `collectionIds` or `tagIds`, or an unknown `typeId`, through the mapped foreign-key
// violation
// ast-grep-ignore: route-declares-unthrown-error
export const PatchThrows = [ErrorTypes.NOT_FOUND] as const

export const PATCH = async (req: HttpRequest<typeof PatchInput>): Promise<HttpResult<typeof PatchOutput>> => {
  const productService = req.scope.resolve(Modules.PRODUCT)
  const product = await productService.updateProduct(req.params.id, req.body)
  const [groupings, metafields] = await Promise.all([
    productService.retrieveProductGroupings(product.id),
    productService.retrieveProductMetafields(product.id),
  ])
  return { status: 200, json: { product: { ...product, ...groupings, metafields } } }
}

export const DeleteInput = { params: IdParams }
export const DeleteOutput = DeleteResponse

export const DELETE = async (req: HttpRequest<typeof DeleteInput>): Promise<HttpResult<typeof DeleteOutput>> => {
  const productService = req.scope.resolve(Modules.PRODUCT)
  await productService.softDeleteProducts([req.params.id])
  return { status: 200, json: { id: req.params.id, deleted: true } }
}
