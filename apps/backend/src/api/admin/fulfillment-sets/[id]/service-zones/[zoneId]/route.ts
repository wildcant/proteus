import type { IFulfillmentModuleService } from '@core/types/index.js'
import { Modules } from '@core/utils/index.js'
import {
  AdminServiceZoneDetailResponse,
  AdminUpdateServiceZone,
  AdminUpdateServiceZoneResponse,
  AdminZoneIdParams,
  DeleteResponse,
} from '@proteus/http-schemas/admin'
import type { HttpRequest, HttpResult } from '@server/ports.js'

export const GetInput = { params: AdminZoneIdParams }
export const GetOutput = AdminServiceZoneDetailResponse

export const GET = async (req: HttpRequest<typeof GetInput>): Promise<HttpResult<typeof GetOutput>> => {
  const service = req.scope.resolve<IFulfillmentModuleService>(Modules.FULFILLMENT)

  const [serviceZone, geoZones] = await Promise.all([
    service.retrieveServiceZone(req.params.zoneId),
    service.listGeoZones({ serviceZoneId: req.params.zoneId }),
  ])

  return { status: 200, json: { serviceZone: { ...serviceZone, geoZones } } }
}

export const PostInput = { params: AdminZoneIdParams, body: AdminUpdateServiceZone }
export const PostOutput = AdminUpdateServiceZoneResponse

export const POST = async (req: HttpRequest<typeof PostInput>): Promise<HttpResult<typeof PostOutput>> => {
  const service = req.scope.resolve<IFulfillmentModuleService>(Modules.FULFILLMENT)
  const serviceZone = await service.updateServiceZone(req.params.zoneId, req.body)
  return { status: 200, json: { serviceZone } }
}

export const DeleteInput = { params: AdminZoneIdParams }
export const DeleteOutput = DeleteResponse

export const DELETE = async (req: HttpRequest<typeof DeleteInput>): Promise<HttpResult<typeof DeleteOutput>> => {
  const service = req.scope.resolve<IFulfillmentModuleService>(Modules.FULFILLMENT)
  await service.softDeleteServiceZones([req.params.zoneId])
  return { status: 200, json: { id: req.params.zoneId, deleted: true } }
}
