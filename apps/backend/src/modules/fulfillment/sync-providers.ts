import { buildCascadeGraph } from '../../core/db/cascade-graph.js'
import { noopLogger } from '../../framework/logger/index.js'
import type { Database } from '../../schema.type.js'
import { seedProviders } from './loaders/providers.js'
import * as models from './models/index.js'
import { fulfillmentProviderDeclarations } from './provider-declarations.js'
import { FulfillmentProviderRepository } from './repositories/index.js'
import { FulfillmentProviderService } from './services/fulfillment-provider-service.js'

const cascadeGraph = buildCascadeGraph(models)

export async function syncFulfillmentProviders(getDb: () => Database) {
  const fulfillmentProviderRepository = new FulfillmentProviderRepository({ getDb, cascadeGraph })
  const providerService = new FulfillmentProviderService({
    container: undefined as never,
    fulfillmentProviderRepository,
    logger: noopLogger,
  })
  await seedProviders(providerService, fulfillmentProviderDeclarations.providers)
}
