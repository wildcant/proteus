import type { IFulfillmentModuleService } from '@core/types/index.js'
import { Modules } from '@core/utils/index.js'
import {
  AdminUpdateShippingProfile,
  AdminUpdateShippingProfileResponse,
  DeleteResponse,
  IdParams,
} from '@proteus/http-schemas/admin'
import type { HttpRequest, HttpResult } from '@server/ports.js'

export const PostInput = { params: IdParams, body: AdminUpdateShippingProfile }
export const PostOutput = AdminUpdateShippingProfileResponse

export const POST = async (req: HttpRequest<typeof PostInput>): Promise<HttpResult<typeof PostOutput>> => {
  const service = req.scope.resolve<IFulfillmentModuleService>(Modules.FULFILLMENT)
  const shippingProfile = await service.updateShippingProfile(req.params.id, req.body)
  return { status: 200, json: { shippingProfile } }
}

export const DeleteInput = { params: IdParams }
export const DeleteOutput = DeleteResponse

export const DELETE = async (req: HttpRequest<typeof DeleteInput>): Promise<HttpResult<typeof DeleteOutput>> => {
  const service = req.scope.resolve<IFulfillmentModuleService>(Modules.FULFILLMENT)
  await service.softDeleteShippingProfiles([req.params.id])
  return { status: 200, json: { id: req.params.id, deleted: true } }
}
