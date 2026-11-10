import { ErrorTypes } from '@core/errors/app-error.js'
import { Modules } from '@core/utils/modules-definition.js'
import type { HttpRequest, HttpResult } from '@framework/http/ports.js'
import { AdminProductTypeResponse, AdminUpdateProductType, DeleteResponse, IdParams } from '@proteus/http-schemas/admin'

export const GetInput = { params: IdParams }
export const GetOutput = AdminProductTypeResponse
// retrieveType throws NOT_FOUND from the module when the Product Type does not exist
// ast-grep-ignore: route-declares-unthrown-error
export const GetThrows = [ErrorTypes.NOT_FOUND] as const

export const GET = async (req: HttpRequest<typeof GetInput>): Promise<HttpResult<typeof GetOutput>> => {
  const productService = req.scope.resolve(Modules.PRODUCT)
  const type = await productService.retrieveType(req.params.id)
  return { status: 200, json: { type } }
}

export const PatchInput = { params: IdParams, body: AdminUpdateProductType }
export const PatchOutput = AdminProductTypeResponse
// updateType throws NOT_FOUND (missing Product Type) and DUPLICATE_ERROR (value taken) from the module
// ast-grep-ignore: route-declares-unthrown-error
export const PatchThrows = [ErrorTypes.NOT_FOUND, ErrorTypes.DUPLICATE_ERROR] as const

export const PATCH = async (req: HttpRequest<typeof PatchInput>): Promise<HttpResult<typeof PatchOutput>> => {
  const productService = req.scope.resolve(Modules.PRODUCT)
  const type = await productService.updateType(req.params.id, req.body)
  return { status: 200, json: { type } }
}

export const DeleteInput = { params: IdParams }
export const DeleteOutput = DeleteResponse

export const DELETE = async (req: HttpRequest<typeof DeleteInput>): Promise<HttpResult<typeof DeleteOutput>> => {
  const productService = req.scope.resolve(Modules.PRODUCT)
  await productService.softDeleteTypes([req.params.id])
  return { status: 200, json: { id: req.params.id, deleted: true } }
}
