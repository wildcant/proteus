import type { NotificationModuleOptions } from '../../core/types/notification/common.js'
import localProvider from '../../providers/notification-local/index.js'

/**
 * Single source of truth for which notification providers are configured.
 * Used by container.ts (DI registration) and the seed script (DB upsert).
 */
export const notificationProviderDeclarations: NotificationModuleOptions = {
  providers: [
    {
      resolve: localProvider,
      id: 'default',
      channels: ['feed'],
    },
  ],
}
