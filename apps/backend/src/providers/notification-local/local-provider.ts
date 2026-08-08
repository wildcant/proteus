import type {
  NotificationProviderSendInput,
  NotificationProviderSendOutput,
} from '../../core/types/notification/mutations.js'
import { AbstractNotificationProviderService } from '../../core/utils/abstract-notification-provider.js'

export class LocalNotificationProvider extends AbstractNotificationProviderService {
  static identifier = 'local'

  async send(notification: NotificationProviderSendInput): Promise<NotificationProviderSendOutput> {
    const message =
      `Attempting to send a notification to: '${notification.to}'` +
      ` on the channel: '${notification.channel}' with template: '${notification.template}'` +
      ` and data: '${JSON.stringify(notification.data)}'`

    this.logger.info(message)

    return {}
  }
}
