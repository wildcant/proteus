import { env } from '@env'
import stripeProvider from '../../providers/payment-stripe/index.js'
import type { PaymentModuleOptions } from './loaders/providers.js'

/**
 * Single source of truth for which payment providers are configured.
 * Used by container.ts (DI registration) and the seed script (DB upsert).
 */
export const paymentProviderDeclarations: PaymentModuleOptions = {
  providers: [
    {
      resolve: stripeProvider,
      id: 'default',
      options: {
        apiKey: env.STRIPE_SECRET_KEY,
        webhookSecret: env.STRIPE_WEBHOOK_SECRET,
        publishableKey: env.STRIPE_PUBLISHABLE_KEY,
      },
    },
  ],
}
