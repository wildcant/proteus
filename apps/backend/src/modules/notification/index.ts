import { Module } from '../../core/utils/module.js'
import { Modules } from '../../core/utils/modules-definition.js'
import { loadProviders } from './loaders/providers.js'
import * as models from './models/index.js'
import { NotificationRepository } from './repositories/notification.js'
import { NotificationProviderRepository } from './repositories/notification-provider.js'
import { NotificationModuleService } from './services/notification-module-service.js'

export { notificationProviderDeclarations } from './provider-declarations.js'
export { syncNotificationProviders } from './sync-providers.js'

export default Module(Modules.NOTIFICATION, {
  service: NotificationModuleService,
  models,
  repositories: {
    notificationRepository: NotificationRepository,
    notificationProviderRepository: NotificationProviderRepository,
  },
  loaders: [loadProviders],
})
