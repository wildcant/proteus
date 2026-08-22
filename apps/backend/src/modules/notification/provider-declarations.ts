import type { NotificationModuleOptions, NotificationProviderConfig } from '../../core/types/notification/common.js'
import { env } from '../../env.js'
import resendProvider from '../../providers/notification-email-resend/index.js'
// import sendgridProvider from '../../providers/notification-email-sendgrid/index.js'
import localProvider from '../../providers/notification-local/index.js'

// TODO: Explore module providers as part of config
// MOCKS covers the e2e test server, which runs with NODE_ENV=test and needs the
// email provider registered so MSW can intercept the Resend call.
const resendEmailProvider: NotificationProviderConfig | null =
  env.NODE_ENV === 'development' || env.MOCKS
    ? {
        resolve: resendProvider,
        id: 'resend',
        channels: ['email'],
        options: {
          apiKey: env.RESEND_API_KEY,
          from: env.RESEND_FROM,
        },
      }
    : null

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
    ...(resendEmailProvider ? [resendEmailProvider] : []),
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
