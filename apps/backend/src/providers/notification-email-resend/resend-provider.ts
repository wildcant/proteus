import { Resend } from 'resend'
import { AppError, ErrorTypes } from '../../core/errors/app-error.js'
import type { Logger } from '../../core/types/logger.js'
import type {
  NotificationProviderSendInput,
  NotificationProviderSendOutput,
} from '../../core/types/notification/mutations.js'
import { AbstractNotificationProviderService } from '../../core/utils/abstract-notification-provider.js'

type ResendProviderConfig = {
  apiKey: string
  from: string
}

type ResendData = {
  subject?: string
  html?: string
  attachments?: { content: string; filename: string }[]
}

export class ResendNotificationProvider extends AbstractNotificationProviderService<ResendProviderConfig> {
  static identifier = 'notification-email-resend'

  private client: Resend

  constructor(container: { logger: Logger }, config: ResendProviderConfig) {
    super(container, config)
    this.client = new Resend(config.apiKey)
  }

  async send(notification: NotificationProviderSendInput): Promise<NotificationProviderSendOutput> {
    const data = (notification.data ?? {}) as ResendData
    const from = notification.from ?? this.config.from

    const { data: result, error } = notification.template
      ? await this.client.emails.send({
          from,
          to: notification.to,
          template: {
            id: notification.template,
            variables: (notification.data ?? {}) as Record<string, string | number>,
          },
        })
      : await this.client.emails.send({
          from,
          to: notification.to,
          subject: data.subject ?? '',
          html: data.html ?? '',
          attachments: data.attachments?.map((attachment) => ({
            content: Buffer.from(attachment.content, 'base64'),
            filename: attachment.filename,
          })),
        })

    if (error) {
      throw new AppError({ type: ErrorTypes.UNEXPECTED_STATE, message: `Resend send failed: ${error.message}` })
    }

    return {
      externalId: result?.id,
    }
  }
}
