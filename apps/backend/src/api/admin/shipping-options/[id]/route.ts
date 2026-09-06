import type { IFulfillmentModuleService } from '@core/types/index.js'
import { Modules } from '@core/utils/index.js'
import {
  AdminShippingOptionResponse,
  AdminUpdateShippingOption,
  AdminUpdateShippingOptionResponse,
  DeleteResponse,
  IdParams,
} from '@proteus/http-schemas/admin'
import type { HttpRequest, HttpResult } from '@server/ports.js'

export const GetInput = { params: IdParams }
export const GetOutput = AdminShippingOptionResponse

export const GET = async (req: HttpRequest<typeof GetInput>): Promise<HttpResult<typeof GetOutput>> => {
  const service = req.scope.resolve<IFulfillmentModuleService>(Modules.FULFILLMENT)
  const shippingOption = await service.retrieveShippingOption(req.params.id)
  return { status: 200, json: { shippingOption } }
}

export const PostInput = { params: IdParams, body: AdminUpdateShippingOption }
export const PostOutput = AdminUpdateShippingOptionResponse

export const POST = async (req: HttpRequest<typeof PostInput>): Promise<HttpResult<typeof PostOutput>> => {
  const service = req.scope.resolve<IFulfillmentModuleService>(Modules.FULFILLMENT)
  const shippingOption = await service.updateShippingOption(req.params.id, req.body)
  return { status: 200, json: { shippingOption } }
}

export const DeleteInput = { params: IdParams }
export const DeleteOutput = DeleteResponse

export const DELETE = async (req: HttpRequest<typeof DeleteInput>): Promise<HttpResult<typeof DeleteOutput>> => {
  const service = req.scope.resolve<IFulfillmentModuleService>(Modules.FULFILLMENT)
  await service.softDeleteShippingOptions([req.params.id])
  return { status: 200, json: { id: req.params.id, deleted: true } }
}
