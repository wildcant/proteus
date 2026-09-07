import type { IFulfillmentModuleService } from '@core/types/index.js'
import { Modules } from '@core/utils/index.js'
import {
  AdminFulfillmentSetDetailResponse,
  AdminUpdateFulfillmentSet,
  AdminUpdateFulfillmentSetResponse,
  DeleteResponse,
  IdParams,
} from '@proteus/http-schemas/admin'
import type { HttpRequest, HttpResult } from '@server/ports.js'

export const GetInput = { params: IdParams }
export const GetOutput = AdminFulfillmentSetDetailResponse

export const GET = async (req: HttpRequest<typeof GetInput>): Promise<HttpResult<typeof GetOutput>> => {
  const service = req.scope.resolve<IFulfillmentModuleService>(Modules.FULFILLMENT)

  const [fulfillmentSet, serviceZones] = await Promise.all([
    service.retrieveFulfillmentSet(req.params.id),
    service.listServiceZones({ fulfillmentSetId: req.params.id }),
  ])

  return { status: 200, json: { fulfillmentSet: { ...fulfillmentSet, serviceZones } } }
}

export const PostInput = { params: IdParams, body: AdminUpdateFulfillmentSet }
export const PostOutput = AdminUpdateFulfillmentSetResponse

export const POST = async (req: HttpRequest<typeof PostInput>): Promise<HttpResult<typeof PostOutput>> => {
  const service = req.scope.resolve<IFulfillmentModuleService>(Modules.FULFILLMENT)
  const fulfillmentSet = await service.updateFulfillmentSet(req.params.id, req.body)
  return { status: 200, json: { fulfillmentSet } }
}

export const DeleteInput = { params: IdParams }
export const DeleteOutput = DeleteResponse

export const DELETE = async (req: HttpRequest<typeof DeleteInput>): Promise<HttpResult<typeof DeleteOutput>> => {
  const service = req.scope.resolve<IFulfillmentModuleService>(Modules.FULFILLMENT)
  await service.softDeleteFulfillmentSets([req.params.id])
  return { status: 200, json: { id: req.params.id, deleted: true } }
}
