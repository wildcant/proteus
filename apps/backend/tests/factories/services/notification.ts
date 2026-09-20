import type { AppContainer } from '../../../src/core/types/container.js'
import type { FilterableNotificationProps } from '../../../src/core/types/notification/common.js'
import { Modules } from '../../../src/core/utils/modules-definition.js'

// ---- Reads ----

export async function listNotifications(container: AppContainer, filters?: FilterableNotificationProps) {
  const notificationService = container.resolve(Modules.NOTIFICATION)

  return notificationService.listNotifications(filters)
}
