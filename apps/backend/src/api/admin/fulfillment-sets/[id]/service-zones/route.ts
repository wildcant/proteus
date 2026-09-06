import type { IFulfillmentModuleService } from '@core/types/index.js'
import { Modules } from '@core/utils/index.js'
import { AdminCreateServiceZone, AdminCreateServiceZoneResponse, IdParams } from '@proteus/http-schemas/admin'
import type { HttpRequest, HttpResult } from '@server/ports.js'

export const PostInput = { params: IdParams, body: AdminCreateServiceZone }
export const PostOutput = AdminCreateServiceZoneResponse

export const POST = async (req: HttpRequest<typeof PostInput>): Promise<HttpResult<typeof PostOutput>> => {
  const service = req.scope.resolve<IFulfillmentModuleService>(Modules.FULFILLMENT)
  const serviceZone = await service.createServiceZone({ ...req.body, fulfillmentSetId: req.params.id })
  return { status: 201, json: { serviceZone } }
}
