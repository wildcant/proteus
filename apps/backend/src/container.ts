/**
 * Shared container bootstrap — registers modules, links, and workflows.
 * Platform-specific deps (logger, dbProvider) are injected by the caller,
 * so each entry point only bundles its own provider (tree-shaking friendly).
 */

import { asFunction, asValue, createContainer } from 'awilix'
import { appConfig } from './config.js'
import { bootstrapModule } from './core/bootstrap/index.js'
import { defineAppConfig } from './core/config/index.js'
import type { InputConfig } from './core/config/types.js'
import type { DbProvider } from './core/db/ports.js'
import { AppError, ErrorTypes } from './core/errors/app-error.js'
import type { Logger } from './core/types/logger.js'
import { DeferredTasks } from './core/utils/deferred-tasks.js'
import { ContainerRegistrationKeys } from './core/utils/index.js'
import { resolveWorkflowEngineName } from './core/workflows/engine-selection.js'
import { createSimpleWorkflowEngine } from './core/workflows/simple-adapter.js'
import { setWorkflowEngine, type WorkflowEngine } from './core/workflows/types.js'
import { env } from './env.js'
import { registerLinkService } from './link-modules/index.js'
import authModule, { authProviderDeclarations } from './modules/auth/index.js'
import cartModule from './modules/cart/index.js'
import customerModule from './modules/customer/index.js'
import fileModule, { fileProviderDeclarations } from './modules/file/index.js'
import fulfillmentModule, { fulfillmentProviderDeclarations } from './modules/fulfillment/index.js'
import inventoryModule from './modules/inventory/index.js'
import notificationModule, { notificationProviderDeclarations } from './modules/notification/index.js'
import orderModule from './modules/order/index.js'
import paymentModule, { paymentProviderDeclarations } from './modules/payment/index.js'
import pricingModule from './modules/pricing/index.js'
import productModule from './modules/product/index.js'
import userModule from './modules/user/index.js'

export type BootstrapContainerDeps = {
  logger: Logger
  dbProvider: DbProvider
  config?: InputConfig
  /**
   * Builds the Temporal engine when the resolved engine is `temporal`.
   *
   * Injected for the same reason `logger` and `dbProvider` are: `@temporalio/*` reaches
   * `@temporalio/core-bridge`, a native addon workerd cannot load, and a static import here would
   * put it in the workerd bundle whether or not that build ever uses it. `check:deps` enforces
   * that boundary, so this is not a stylistic choice — an import here fails the gate.
   */
  createTemporalWorkflowEngine?: () => WorkflowEngine
}

export async function bootstrapContainer(deps: BootstrapContainerDeps) {
  const container = createContainer()
  const { logger, dbProvider, config } = deps

  const configModule = config ? defineAppConfig(config) : appConfig

  container.register({
    [ContainerRegistrationKeys.CONFIG_MODULE]: asFunction(() => configModule),
    [ContainerRegistrationKeys.LOGGER]: asValue(logger),
    [ContainerRegistrationKeys.DB_PROVIDER]: asValue(dbProvider),
    [ContainerRegistrationKeys.GET_DB]: asValue(dbProvider.getDb),
  })

  // Registered here rather than inside a module: the payment webhook route is the caller, and a
  // route cannot reach into a module's private container.
  container.register({
    [ContainerRegistrationKeys.DEFERRED_TASKS]: asValue(
      new DeferredTasks(configModule.projectConfig.webhooks, dbProvider, logger),
    ),
  })

  await bootstrapModule(container, authModule, authProviderDeclarations)
  await bootstrapModule(container, cartModule)
  await bootstrapModule(container, customerModule)
  await bootstrapModule(container, fileModule, fileProviderDeclarations)
  await bootstrapModule(container, fulfillmentModule, fulfillmentProviderDeclarations)
  await bootstrapModule(container, inventoryModule)
  await bootstrapModule(container, pricingModule)
  await bootstrapModule(container, productModule)
  await bootstrapModule(container, notificationModule, notificationProviderDeclarations)
  await bootstrapModule(container, orderModule)
  await bootstrapModule(container, paymentModule, paymentProviderDeclarations)
  await bootstrapModule(container, userModule)

  registerLinkService(container)
  setWorkflowEngine(selectWorkflowEngine(deps, configModule.projectConfig.workflows.engine), container)

  return container
}

function selectWorkflowEngine(
  deps: BootstrapContainerDeps,
  configured: ReturnType<typeof defineAppConfig>['projectConfig']['workflows']['engine'],
): WorkflowEngine {
  const engine = resolveWorkflowEngineName({ configured, runtime: env.RUNTIME })
  if (engine === 'simple') return createSimpleWorkflowEngine()

  const createEngine = deps.createTemporalWorkflowEngine
  if (!createEngine) {
    throw new AppError({
      type: ErrorTypes.UNEXPECTED_STATE,
      message:
        'The temporal workflow engine was selected but no factory was injected. The entry point ' +
        'building this container must pass `createTemporalWorkflowEngine`, or pin ' +
        '`projectConfig.workflows.engine` to "simple".',
    })
  }

  return createEngine()
}
