import type { CreateNotificationDTO } from '@core/types/notification/mutations.js'
import type { INotificationModuleService } from '@core/types/notification/service.js'
import { Modules } from '@core/utils/index.js'
import type { WorkflowContext } from '@core/workflows/types.js'

export type NotifyOnFailureInput = {
  notifications: CreateNotificationDTO[]
}

export async function notifyOnFailureStep(ctx: WorkflowContext, input: NotifyOnFailureInput): Promise<void> {
  await ctx.step<NotifyOnFailureInput>(
    'notify-on-failure',
    async () => {
      // No-op — return the notification payload as compensation data
      return input
    },
    async ({ notifications }, { container }) => {
      const notificationService = container.resolve<INotificationModuleService>(Modules.NOTIFICATION)
      await notificationService.createNotifications(notifications)
    },
  )
}
