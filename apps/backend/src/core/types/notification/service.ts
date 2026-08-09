import type { FindConfig } from '../common.js'
import type { Context } from '../context.js'
import type { FilterableNotificationProps, NotificationDTO } from './common.js'
import type { CreateNotificationDTO } from './mutations.js'

export type INotificationModuleService = {
  createNotifications(data: CreateNotificationDTO[], context?: Context): Promise<NotificationDTO[]>
  createNotification(data: CreateNotificationDTO, context?: Context): Promise<NotificationDTO>
  retrieveNotification(id: string, config?: FindConfig<NotificationDTO>, context?: Context): Promise<NotificationDTO>
  listNotifications(
    filters?: FilterableNotificationProps,
    config?: FindConfig<NotificationDTO>,
    context?: Context,
  ): Promise<NotificationDTO[]>
  listAndCountNotifications(
    filters?: FilterableNotificationProps,
    config?: FindConfig<NotificationDTO>,
    context?: Context,
  ): Promise<[NotificationDTO[], number]>
}
