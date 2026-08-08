import type { NotificationDTO } from '@core/types/notification/common.js'
import type { CreateNotificationDTO } from '@core/types/notification/mutations.js'
import type { INotificationModuleService } from '@core/types/notification/service.js'
import { Modules } from '@core/utils/index.js'
import type { WorkflowContext } from '@core/workflows/types.js'

export type SendNotificationsInput = {
  notifications: CreateNotificationDTO[]
}

export async function sendNotificationsStep(
  ctx: WorkflowContext,
  input: SendNotificationsInput,
): Promise<NotificationDTO[]> {
  return ctx.step<NotificationDTO[]>('send-notifications', async ({ container }) => {
    const notificationService = container.resolve<INotificationModuleService>(Modules.NOTIFICATION)
    return notificationService.createNotifications(input.notifications)
  })
}
