import { buildCascadeGraph } from '../../core/db/cascade-graph.js'
import { noopLogger } from '../../framework/logger/index.js'
import type { Database } from '../../schema.type.js'
import { seedProviders } from './loaders/providers.js'
import { accountHolderTable } from './models/account-holder.js'
import { captureTable } from './models/capture.js'
import { paymentTable } from './models/payment.js'
import { paymentCollectionTable } from './models/payment-collection.js'
import { paymentProviderTable } from './models/payment-provider.js'
import { paymentSessionTable } from './models/payment-session.js'
import { refundTable } from './models/refund.js'
import { refundReasonTable } from './models/refund-reason.js'
import { paymentProviderDeclarations } from './provider-declarations.js'
import { PaymentProviderRepository } from './repositories/payment-provider.js'
import { PaymentProviderService } from './services/payment-provider-service.js'

const cascadeGraph = buildCascadeGraph({
  accountHolderTable,
  captureTable,
  paymentCollectionTable,
  paymentProviderTable,
  paymentSessionTable,
  paymentTable,
  refundReasonTable,
  refundTable,
})

/** Syncs configured payment providers to the database. Used out-of-band for workerd deployments. */
export async function syncPaymentProviders(getDb: () => Database) {
  const paymentProviderRepository = new PaymentProviderRepository({ getDb, cascadeGraph })
  // Safe: this runs outside the DI container (standalone script). upsert only touches the repository, never resolves providers.
  const providerService = new PaymentProviderService({
    container: undefined as never,
    paymentProviderRepository,
    logger: noopLogger,
  })
  await seedProviders(providerService, paymentProviderDeclarations.providers)
}
