import type { INotificationModuleService } from '@core/types/notification/service.js'
import { Modules } from '@core/utils/modules-definition.js'
import type { HttpRequest, HttpResult } from '@framework/http/ports.js'
import { AdminNotificationResponse, IdParams } from '@proteus/http-schemas/admin'

export const GetInput = { params: IdParams }
export const GetOutput = AdminNotificationResponse

export const GET = async (req: HttpRequest<typeof GetInput>): Promise<HttpResult<typeof GetOutput>> => {
  const notificationService = req.scope.resolve<INotificationModuleService>(Modules.NOTIFICATION)
  const notification = await notificationService.retrieveNotification(req.params.id)
  return { status: 200, json: { notification } }
}
