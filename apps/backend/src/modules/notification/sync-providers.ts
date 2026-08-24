import { buildCascadeGraph } from '../../core/db/cascade-graph.js'
import { noopLogger } from '../../framework/logger/index.js'
import type { Database } from '../../schema.type.js'
import { seedProviders } from './loaders/providers.js'
import * as models from './models/index.js'
import { notificationProviderDeclarations } from './provider-declarations.js'
import { NotificationProviderRepository } from './repositories/index.js'
import { NotificationProviderService } from './services/notification-provider-service.js'

const cascadeGraph = buildCascadeGraph(models)

/** Syncs configured notification providers to the database. Used out-of-band for workerd deployments. */
export async function syncNotificationProviders(getDb: () => Database) {
  const notificationProviderRepository = new NotificationProviderRepository({ getDb, cascadeGraph })
  const providerService = new NotificationProviderService({
    container: undefined as never,
    notificationProviderRepository,
    logger: noopLogger,
  })
  await seedProviders(providerService, notificationProviderDeclarations.providers)
}
