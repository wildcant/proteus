import { type AwilixContainer, asClass, asValue, createContainer } from 'awilix'
import { buildCascadeGraph } from '../../core/db/cascade-graph.js'
import type { Logger } from '../../core/types/logger.js'
import { ContainerRegistrationKeys } from '../../core/utils/container.js'
import type { ModuleDefinition } from '../../core/utils/module.js'
import { createWithTransaction } from '../../core/utils/with-transaction.js'
import type { Database } from '../../schema.type.js'

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
    cascadeGraph: asValue(buildCascadeGraph(moduleDefinition.models)),
  })

  for (const [key, RepoClass] of Object.entries(moduleDefinition.repositories)) {
    localContainer.register({
      [key]: asClass(RepoClass).singleton(),
    })
  }

  if (moduleDefinition.loaders) {
    for (const loader of moduleDefinition.loaders) {
      await loader({ container: localContainer, options: options as Record<string, unknown> })
    }
  }

  const service = new moduleDefinition.service(localContainer.cradle)

  sharedContainer.register({
    [moduleDefinition.key]: asValue(service),
  })

  if (moduleDefinition.postLoaders) {
    for (const loader of moduleDefinition.postLoaders) {
      await loader({ container: sharedContainer, options: options as Record<string, unknown> })
    }
  }
}
