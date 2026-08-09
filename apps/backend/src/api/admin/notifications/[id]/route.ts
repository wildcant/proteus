import type { INotificationModuleService } from '@core/types/index.js'
import { Modules } from '@core/utils/index.js'
import { AdminNotificationResponse, IdParams } from '@proteus/http-schemas/admin'
import type { HttpRequest, HttpResult } from '../../../../server/ports.js'

export const GetInput = { params: IdParams }
export const GetOutput = AdminNotificationResponse

export const GET = async (req: HttpRequest<typeof GetInput>): Promise<HttpResult<typeof GetOutput>> => {
  const notificationService = req.scope.resolve<INotificationModuleService>(Modules.NOTIFICATION)
  const notification = await notificationService.retrieveNotification(req.params.id)
  return { status: 200, json: { notification } }
}
