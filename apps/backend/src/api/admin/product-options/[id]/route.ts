import type { IProductModuleService } from '@core/types/index.js'
import { Modules } from '@core/utils/index.js'
import {
  AdminProductOptionResponse,
  AdminUpdateProductOption,
  DeleteResponse,
  IdParams,
} from '@proteus/http-schemas/admin'
import type { HttpRequest, HttpResult } from '../../../../server/ports.js'

export const GetInput = { params: IdParams }
export const GetOutput = AdminProductOptionResponse

export const GET = async (req: HttpRequest<typeof GetInput>): Promise<HttpResult<typeof GetOutput>> => {
  const productService = req.scope.resolve<IProductModuleService>(Modules.PRODUCT)
  const productOption = await productService.retrieveProductOption(req.params.id)
  return { status: 200, json: { productOption } }
}

export const PatchInput = { params: IdParams, body: AdminUpdateProductOption }
export const PatchOutput = AdminProductOptionResponse

export const PATCH = async (req: HttpRequest<typeof PatchInput>): Promise<HttpResult<typeof PatchOutput>> => {
  const productService = req.scope.resolve<IProductModuleService>(Modules.PRODUCT)
  const productOption = await productService.updateProductOption(req.params.id, req.body)
  return { status: 200, json: { productOption } }
}

export const DeleteInput = { params: IdParams }
export const DeleteOutput = DeleteResponse

export const DELETE = async (req: HttpRequest<typeof DeleteInput>): Promise<HttpResult<typeof DeleteOutput>> => {
  const productService = req.scope.resolve<IProductModuleService>(Modules.PRODUCT)
  await productService.deleteProductOptions([req.params.id])
  return { status: 200, json: { id: req.params.id, deleted: true } }
}
