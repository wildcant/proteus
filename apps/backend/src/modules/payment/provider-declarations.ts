import { env } from '@env'
import type { ConfigModule } from '../../core/types/config.js'
import stripeProvider from '../../providers/payment-stripe/index.js'
import type { PaymentModuleOptions } from './loaders/providers.js'

/**
 * Single source of truth for which payment providers are configured: the ones the store turned on
 * in `projectConfig.providers.payment`. Used by container.ts (DI registration) and the seed script
 * (DB upsert).
 */
export function paymentProviderDeclarations(
  providers: ConfigModule['projectConfig']['providers'],
): PaymentModuleOptions {
  return {
    providers: providers.payment.includes('stripe')
      ? [
          {
            resolve: stripeProvider,
            id: 'default',
            options: {
              apiKey: env.STRIPE_SECRET_KEY,
              webhookSecret: env.STRIPE_WEBHOOK_SECRET,
              publishableKey: env.STRIPE_PUBLISHABLE_KEY,
            },
          },
        ]
      : [],
  }
}
