import type { IFulfillmentModuleService } from '@core/types/fulfillment/service.js'
import { Modules } from '@core/utils/modules-definition.js'
import type { HttpRequest, HttpResult } from '@framework/http/ports.js'
import {
  AdminCreateShippingProfile,
  AdminCreateShippingProfileResponse,
  AdminShippingProfileListResponse,
} from '@proteus/http-schemas/admin'

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
