import type { INotificationModuleService } from '@core/types/notification/service.js'
import { env } from '../../env.js'

export async function sendVerificationEmail(
  notificationService: INotificationModuleService,
  email: string,
  verificationCode: string,
): Promise<void> {
  const verifyLink = `${env.STORE_URL}/verify?code=${verificationCode}`
  await notificationService.createNotification({
    to: email,
    channel: 'email',
    template: 'verify-email',
    data: { email, verifyLink },
  })
}
