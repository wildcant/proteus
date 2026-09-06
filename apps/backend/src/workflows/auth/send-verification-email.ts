import type { INotificationModuleService } from '@core/types/notification/service.js'
import { NotificationTemplates } from '@core/utils/index.js'
import { env } from '@env'

export async function sendVerificationEmail(
  notificationService: INotificationModuleService,
  email: string,
  verificationCode: string,
): Promise<void> {
  const verifyLink = `${env.STORE_URL}/verify?code=${verificationCode}`
  await notificationService.createNotification({
    to: email,
    channel: 'email',
    template: NotificationTemplates.VERIFY_EMAIL,
    data: { email, verifyLink },
  })
}
