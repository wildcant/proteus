import type { IFulfillmentModuleService } from '@core/types/index.js'
import { Modules } from '@core/utils/index.js'
import {
  AdminCreateShippingProfile,
  AdminCreateShippingProfileResponse,
  AdminShippingProfileListResponse,
} from '@proteus/http-schemas/admin'
import type { HttpRequest, HttpResult } from '@server/ports.js'

export const GetOutput = AdminShippingProfileListResponse

export const GET = async (req: HttpRequest): Promise<HttpResult<typeof GetOutput>> => {
  const service = req.scope.resolve<IFulfillmentModuleService>(Modules.FULFILLMENT)
  const shippingProfiles = await service.listShippingProfiles()
  return { status: 200, json: { shippingProfiles } }
}

export const PostInput = { body: AdminCreateShippingProfile }
export const PostOutput = AdminCreateShippingProfileResponse

export const POST = async (req: HttpRequest<typeof PostInput>): Promise<HttpResult<typeof PostOutput>> => {
  const service = req.scope.resolve<IFulfillmentModuleService>(Modules.FULFILLMENT)
  const shippingProfile = await service.createShippingProfile(req.body)
  return { status: 201, json: { shippingProfile } }
}
