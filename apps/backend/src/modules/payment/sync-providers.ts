import { noopLogger } from '../../framework/logger/index.js'
import type { Database } from '../../schema.type.js'
import { seedProviders } from './loaders/providers.js'
import { paymentProviderDeclarations } from './provider-declarations.js'
import { PaymentProviderRepository } from './repositories/index.js'
import { PaymentProviderService } from './services/payment-provider-service.js'

/** Syncs configured payment providers to the database. Used out-of-band for workerd deployments. */
export async function syncPaymentProviders(getDb: () => Database) {
  const paymentProviderRepository = new PaymentProviderRepository({ getDb })
  // Safe: this runs outside the DI container (standalone script). upsert only touches the repository, never resolves providers.
  const providerService = new PaymentProviderService({
    container: undefined as never,
    paymentProviderRepository,
    logger: noopLogger,
  })
  await seedProviders(providerService, paymentProviderDeclarations.providers)
}
