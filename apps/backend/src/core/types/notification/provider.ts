import type { NotificationProviderSendInput, NotificationProviderSendOutput } from './mutations.js'

export type INotificationProvider = {
  send(input: NotificationProviderSendInput): Promise<NotificationProviderSendOutput>
}
