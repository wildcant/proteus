import type { NotificationModuleOptions } from '../../core/types/notification/common.js'
// import { env } from '../../env.js'
// import sendgridProvider from '../../providers/notification-email-sendgrid/index.js'
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
    // {
    //   resolve: sendgridProvider,
    //   id: 'sendgrid',
    //   channels: ['email'],
    //   options: {
    //     apiKey: env.SENDGRID_API_KEY,
    //     from: env.SENDGRID_FROM,
    //   },
    // },
  ],
}
