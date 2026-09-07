/**
 * Shared container bootstrap — registers modules, links, and workflows.
 * Platform-specific deps (logger, dbProvider) are injected by the caller,
 * so each entry point only bundles its own provider (tree-shaking friendly).
 */

import { type AwilixContainer, asFunction, asValue, createContainer } from 'awilix'
import { appConfig } from './config.js'
import { bootstrapModule } from './core/bootstrap/index.js'
import { defineAppConfig } from './core/config/index.js'
import type { InputConfig } from './core/config/types.js'
import type { DbProvider } from './core/db/ports.js'
import { AppError, ErrorTypes } from './core/errors/app-error.js'
import { resolveEventBusAdapterName } from './core/event-bus/adapter-selection.js'
import { createInlineEventBus } from './core/event-bus/inline-adapter.js'
import { subscriberRegistry } from './core/event-bus/registry.js'
import type { EventBus } from './core/event-bus/types.js'
import type { Logger } from './core/types/logger.js'
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
  /**
   * Builds the bus when the resolved adapter is anything but the in-process one.
   *
   * Injected rather than imported for the same reason the Temporal engine is, and once for both
   * transports: each one is unbuildable on the runtime that did not choose it. Cloudflare Queues
   * arrive as a binding — a live object workerd constructs from `wrangler.jsonc`, which no node
   * process has and no environment file can carry — and Temporal reaches `@temporalio/core-bridge`,
   * a native addon workerd cannot load. The composition root that pins an adapter is the only place
   * that has what building it needs, so it passes a factory instead.
   *
   * One field rather than one per transport: a transport name inside a runtime-agnostic type is the
   * thing adapter selection must not carry, and `selectEventBus` would otherwise grow a branch each
   * time a runtime gains a transport. Keeping Temporal's *engine* and *bus* separate — the reason
   * these are not one injected object — survives regardless, because
   * `createTemporalWorkflowEngine` stays its own field.
   *
   * It takes the container because a subscriber is handed one, and it is not built until this
   * function has finished registering the modules a subscriber resolves from.
   */
  createEventBusAdapter?: (container: AwilixContainer) => EventBus
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

  // The bus is a container registration rather than a module global like the workflow engine,
  // because a publisher always already has the container: a step is handed one, a route handler
  // resolves from `req.scope`. It goes in last so a subscriber it dispatches to sees every module.
  container.register({
    [ContainerRegistrationKeys.EVENT_BUS]: asValue(
      selectEventBus(deps, configModule.projectConfig.eventBus.adapter, container, logger),
    ),
  })

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

/**
 * Refusing to boot is the right answer when the selected adapter cannot be built here: it must not
 * silently become a different one, because "events are being delivered in-process" and "events are
 * being delivered durably" look identical from the publisher and differ entirely when the process
 * dies.
 *
 * The in-process adapter is the one this can build itself — it needs nothing a runtime supplies.
 * Every other adapter arrives through `createEventBusAdapter`, from the composition root that
 * pinned it.
 */
function selectEventBus(
  deps: BootstrapContainerDeps,
  configured: ReturnType<typeof defineAppConfig>['projectConfig']['eventBus']['adapter'],
  container: AwilixContainer,
  logger: Logger,
): EventBus {
  const adapter = resolveEventBusAdapterName({ configured, runtime: env.RUNTIME })
  if (adapter === 'inline') return createInlineEventBus({ registry: subscriberRegistry, container, logger })

  const createAdapter = deps.createEventBusAdapter
  if (!createAdapter) {
    throw new AppError({
      type: ErrorTypes.UNEXPECTED_STATE,
      message:
        `The "${adapter}" event bus adapter was selected but no factory was injected. The entry ` +
        'point building this container must pass `createEventBusAdapter`, or pin ' +
        '`projectConfig.eventBus.adapter` to "inline".',
    })
  }

  return createAdapter(container)
}
