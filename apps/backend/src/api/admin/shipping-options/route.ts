import type { IFulfillmentModuleService } from '@core/types/fulfillment/service.js'
import { Modules } from '@core/utils/modules-definition.js'
import type { HttpRequest, HttpResult } from '@framework/http/ports.js'
import {
  AdminCreateShippingOption,
  AdminCreateShippingOptionResponse,
  AdminShippingOptionListResponse,
} from '@proteus/http-schemas/admin'

export const GetOutput = AdminShippingOptionListResponse

export const GET = async (req: HttpRequest): Promise<HttpResult<typeof GetOutput>> => {
  const service = req.scope.resolve<IFulfillmentModuleService>(Modules.FULFILLMENT)
  const shippingOptions = await service.listShippingOptions()
  return { status: 200, json: { shippingOptions } }
}

export const PostInput = { body: AdminCreateShippingOption }
export const PostOutput = AdminCreateShippingOptionResponse

export const POST = async (req: HttpRequest<typeof PostInput>): Promise<HttpResult<typeof PostOutput>> => {
  const service = req.scope.resolve<IFulfillmentModuleService>(Modules.FULFILLMENT)
  const shippingOption = await service.createShippingOption(req.body)
  return { status: 201, json: { shippingOption } }
}
