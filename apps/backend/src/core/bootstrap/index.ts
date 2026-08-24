import { type AwilixContainer, asClass, asValue, createContainer } from 'awilix'
import type { Database } from '../../schema.type.js'
import { buildCascadeGraph } from '../db/cascade-graph.js'
import type { Logger } from '../types/logger.js'
import { ContainerRegistrationKeys } from '../utils/container.js'
import type { ModuleDefinition } from '../utils/module.js'
import { createWithTransaction } from '../utils/with-transaction.js'

export async function bootstrapModule<TOptions = Record<string, unknown>>(
  sharedContainer: AwilixContainer,
  moduleDefinition: ModuleDefinition,
  options?: TOptions,
): Promise<void> {
  const localContainer = createContainer()

  const getDb: () => Database = sharedContainer.resolve(ContainerRegistrationKeys.GET_DB)
  const logger: Logger = sharedContainer.resolve(ContainerRegistrationKeys.LOGGER)

  localContainer.register({
    getDb: asValue(getDb),
    logger: asValue(logger),
    withTransaction: asValue(createWithTransaction(getDb)),
    // Built once here and shared by the module's repositories. Scoped to this module's models
    // because no foreign key crosses a module boundary, so module scope is already complete.
    cascadeGraph: asValue(buildCascadeGraph(moduleDefinition.models)),
  })

  // Register repositories in the local container (private to this module)
  for (const [key, RepoClass] of Object.entries(moduleDefinition.repositories)) {
    localContainer.register({
      [key]: asClass(RepoClass).singleton(),
    })
  }

  // Run loaders (e.g. provider registration) before instantiating the service
  if (moduleDefinition.loaders) {
    for (const loader of moduleDefinition.loaders) {
      await loader({ container: localContainer, options: options as Record<string, unknown> })
    }
  }

  // Instantiate the module service with all local deps
  const service = new moduleDefinition.service(localContainer.cradle)

  // Expose only the service in the shared container
  sharedContainer.register({
    [moduleDefinition.key]: asValue(service),
  })
}
