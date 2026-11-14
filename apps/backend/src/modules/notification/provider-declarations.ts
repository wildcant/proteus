import { env } from '@env'
import type { ConfigModule } from '../../core/types/config.js'
import type { NotificationModuleOptions, NotificationProviderConfig } from '../../core/types/notification/common.js'
import resendProvider from '../../providers/notification-email-resend/index.js'
// import sendgridProvider from '../../providers/notification-email-sendgrid/index.js'
import localProvider from '../../providers/notification-local/index.js'

/**
 * Single source of truth for which notification providers are configured: the in-app feed always,
 * and the email services the store turned on in `projectConfig.providers.notification`. Used by
 * container.ts (DI registration) and the seed script (DB upsert).
 */
export function notificationProviderDeclarations(
  providers: ConfigModule['projectConfig']['providers'],
): NotificationModuleOptions {
  // MOCKS covers the e2e test server, which runs with NODE_ENV=test and needs the
  // email provider registered so MSW can intercept the Resend call.
  const resendEmailProvider: NotificationProviderConfig | null =
    providers.notification.includes('resend') && (env.NODE_ENV === 'development' || env.MOCKS)
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

  return {
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
}
