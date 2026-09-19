import { type AwilixContainer, asClass, asValue, createContainer } from 'awilix'
import { clearRegistry, registerFeature } from '../../core/access-control/features.js'
import { buildCascadeGraph } from '../../core/db/cascade-graph.js'
import { AppError, ErrorTypes } from '../../core/errors/app-error.js'
import type { ModuleId, PermissionKey } from '../../core/types/access-control/common.js'
import type { Logger } from '../../core/types/logger.js'
import { ContainerRegistrationKeys } from '../../core/utils/container.js'
import type { FeatureDeclaration, ModuleDefinition } from '../../core/utils/module.js'
import { createWithTransaction } from '../../core/utils/with-transaction.js'
import type { Database } from '../../schema.type.js'

export type FeatureRegistryEntry = FeatureDeclaration & { module: string }

const featureRegistry: FeatureRegistryEntry[] = []

export function getFeatureRegistry(): readonly FeatureRegistryEntry[] {
  return featureRegistry
}

export function resetFeatureRegistry(): void {
  featureRegistry.length = 0
  clearRegistry()
}

export function collectFeatures(moduleDefinition: ModuleDefinition): void {
  if (!moduleDefinition.features) return

  for (const feature of moduleDefinition.features) {
    const existing = featureRegistry.find((entry) => entry.id === feature.id)
    if (existing) {
      throw new AppError({
        type: ErrorTypes.UNEXPECTED_STATE,
        message: `Duplicate feature id "${feature.id}": declared by both "${existing.module}" and "${moduleDefinition.key}"`,
      })
    }
    const entry = { ...feature, module: moduleDefinition.key }
    featureRegistry.push(entry)
    registerFeature({ id: feature.id as PermissionKey, title: feature.title, module: entry.module as ModuleId })
  }
}

export async function bootstrapModule<TOptions = Record<string, unknown>>(
  sharedContainer: AwilixContainer,
  moduleDefinition: ModuleDefinition,
  options?: TOptions,
): Promise<void> {
  collectFeatures(moduleDefinition)

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

  // Run post-loaders after service is registered in the shared container
  if (moduleDefinition.postLoaders) {
    for (const loader of moduleDefinition.postLoaders) {
      await loader({ container: sharedContainer, options: options as Record<string, unknown> })
    }
  }
}
