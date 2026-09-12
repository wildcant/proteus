import type { IFulfillmentModuleService } from '@core/types/fulfillment/service.js'
import { Modules } from '@core/utils/modules-definition.js'
import type { HttpRequest, HttpResult } from '@framework/http/ports.js'
import {
  AdminCreateFulfillmentSet,
  AdminCreateFulfillmentSetResponse,
  AdminFulfillmentSetListResponse,
} from '@proteus/http-schemas/admin'

export const GetOutput = AdminFulfillmentSetListResponse

export const GET = async (req: HttpRequest): Promise<HttpResult<typeof GetOutput>> => {
  const service = req.scope.resolve<IFulfillmentModuleService>(Modules.FULFILLMENT)
  const fulfillmentSets = await service.listFulfillmentSets()
  return { status: 200, json: { fulfillmentSets } }
}

export const PostInput = { body: AdminCreateFulfillmentSet }
export const PostOutput = AdminCreateFulfillmentSetResponse

export const POST = async (req: HttpRequest<typeof PostInput>): Promise<HttpResult<typeof PostOutput>> => {
  const service = req.scope.resolve<IFulfillmentModuleService>(Modules.FULFILLMENT)
  const fulfillmentSet = await service.createFulfillmentSet(req.body)
  return { status: 201, json: { fulfillmentSet } }
}
