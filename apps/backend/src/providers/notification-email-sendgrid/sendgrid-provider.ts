import sendgrid from '@sendgrid/mail'
import type { Logger } from '../../core/types/logger.js'
import type {
  NotificationProviderSendInput,
  NotificationProviderSendOutput,
} from '../../core/types/notification/mutations.js'
import { AbstractNotificationProviderService } from '../../core/utils/abstract-notification-provider.js'

type SendGridProviderConfig = {
  apiKey: string
  from: string
}

type Attachment = {
  content: string
  filename: string
  type: string
}

type SendGridData = {
  subject?: string
  html?: string
  attachments?: Attachment[]
  personalizations?: Record<string, unknown>[]
}

type SendGridMailMessage = Parameters<typeof sendgrid.send>[0]

export class SendGridNotificationProvider extends AbstractNotificationProviderService<SendGridProviderConfig> {
  static identifier = 'notification-sendgrid'

  constructor(container: { logger: Logger }, config: SendGridProviderConfig) {
    super(container, config)
    sendgrid.setApiKey(config.apiKey)
  }

  async send(notification: NotificationProviderSendInput): Promise<NotificationProviderSendOutput> {
    const data = (notification.data ?? {}) as SendGridData
    const from = notification.from ?? this.config.from
    const message = this.buildMessage(notification, from, data)
    const [response] = await sendgrid.send(message as unknown as SendGridMailMessage)

    return {
      externalId: response.headers?.['x-message-id'] as string | undefined,
    }
  }

  private buildMessage(notification: NotificationProviderSendInput, from: string, data: SendGridData) {
    const message: Record<string, unknown> = { to: notification.to, from }

    if (notification.template) {
      message.templateId = notification.template
      message.dynamicTemplateData = notification.data
    } else {
      message.subject = data.subject ?? ''
      message.html = data.html ?? ''
    }

    if (data.attachments?.length) {
      message.attachments = data.attachments.map((attachment) => ({
        content: attachment.content,
        filename: attachment.filename,
        type: attachment.type,
      }))
    }

    if (data.personalizations) {
      message.personalizations = data.personalizations
    }

    return message
  }
}
