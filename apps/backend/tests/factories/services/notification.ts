import type { AwilixContainer } from 'awilix'
import type { FilterableNotificationProps } from '../../../src/core/types/notification/common.js'
import type { INotificationModuleService } from '../../../src/core/types/notification/service.js'
import { Modules } from '../../../src/core/utils/index.js'

// ---- Reads ----

export async function listNotifications(container: AwilixContainer, filters?: FilterableNotificationProps) {
  const notificationService = container.resolve<INotificationModuleService>(Modules.NOTIFICATION)

  return notificationService.listNotifications(filters)
}
