import type { INotificationModuleService } from '@core/types/notification/service.js'
import { Modules } from '@core/utils/modules-definition.js'
import type { HttpRequest, HttpResult } from '@framework/http/ports.js'
import { AdminNotificationListParams, AdminNotificationListResponse } from '@proteus/http-schemas/admin'

export const GetInput = { query: AdminNotificationListParams }
export const GetOutput = AdminNotificationListResponse

export const GET = async (req: HttpRequest<typeof GetInput>): Promise<HttpResult<typeof GetOutput>> => {
  const notificationService = req.scope.resolve<INotificationModuleService>(Modules.NOTIFICATION)
  const { pagination, filters } = req.validatedQuery
  const [notifications, count] = await notificationService.listAndCountNotifications(filters, pagination)
  const { offset, limit } = pagination
  return { status: 200, json: { notifications, count, offset, limit } }
}
