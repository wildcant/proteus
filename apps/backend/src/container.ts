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
import type { Logger } from './core/types/logger.js'
import { ContainerRegistrationKeys } from './core/utils/index.js'
import { createSimpleWorkflowEngine } from './core/workflows/simple-adapter.js'
import { setWorkflowEngine } from './core/workflows/types.js'
import { registerLinkService } from './link-modules/index.js'
import authModule, { authProviderDeclarations } from './modules/auth/index.js'
import cartModule from './modules/cart/index.js'
import customerModule from './modules/customer/index.js'
import fulfillmentModule, { fulfillmentProviderDeclarations } from './modules/fulfillment/index.js'
import inventoryModule from './modules/inventory/index.js'
import notificationModule, { notificationProviderDeclarations } from './modules/notification/index.js'
import orderModule from './modules/order/index.js'
import paymentModule, { paymentProviderDeclarations } from './modules/payment/index.js'
import pricingModule from './modules/pricing/index.js'
import productModule from './modules/product/index.js'
import userModule from './modules/user/index.js'

export async function bootstrapContainer(deps: { logger: Logger; dbProvider: DbProvider; config?: InputConfig }) {
  const container = createContainer()
  const { logger, dbProvider, config } = deps

  container.register({
    [ContainerRegistrationKeys.CONFIG_MODULE]: asFunction(() => (config ? defineAppConfig(config) : appConfig)),
    [ContainerRegistrationKeys.LOGGER]: asValue(logger),
    [ContainerRegistrationKeys.DB_PROVIDER]: asValue(dbProvider),
    [ContainerRegistrationKeys.GET_DB]: asValue(dbProvider.getDb),
  })

  await bootstrapModule(container, authModule, authProviderDeclarations)
  await bootstrapModule(container, cartModule)
  await bootstrapModule(container, customerModule)
  await bootstrapModule(container, fulfillmentModule, fulfillmentProviderDeclarations)
  await bootstrapModule(container, inventoryModule)
  await bootstrapModule(container, pricingModule)
  await bootstrapModule(container, productModule)
  await bootstrapModule(container, notificationModule, notificationProviderDeclarations)
  await bootstrapModule(container, orderModule)
  await bootstrapModule(container, paymentModule, paymentProviderDeclarations)
  await bootstrapModule(container, userModule)

  registerLinkService(container)
  setWorkflowEngine(createSimpleWorkflowEngine(), container)

  return container
}
