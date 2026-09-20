import type { NotificationDTO } from '@core/types/notification/common.js'
import type { CreateNotificationDTO } from '@core/types/notification/mutations.js'
import { Modules } from '@core/utils/modules-definition.js'
import type { WorkflowContext } from '@core/workflows/types.js'

export type SendNotificationsInput = {
  notifications: CreateNotificationDTO[]
}

export async function sendNotificationsStep(
  ctx: WorkflowContext,
  input: SendNotificationsInput,
): Promise<NotificationDTO[]> {
  return ctx.step<NotificationDTO[]>('send-notifications', async ({ container }) => {
    const notificationService = container.resolve(Modules.NOTIFICATION)
    return notificationService.createNotifications(input.notifications)
  })
}
