import type { AwilixContainer } from 'awilix'
import type { Database } from '../../schema.type.js'
import type { DbProvider } from '../db/ports.js'
import type { EventBus } from '../event-bus/ports.js'
import { ContainerRegistrationKeys } from '../utils/container.js'
import { Modules } from '../utils/modules-definition.js'
import type { IAccessControlModuleService } from './access-control/service.js'
import type { IAuthModuleService } from './auth/service.js'
import type { ICartModuleService } from './cart/service.js'
import type { ConfigModule } from './config.js'
import type { ICustomerModuleService } from './customer/service.js'
import type { IFileModuleService } from './file/service.js'
import type { IFulfillmentModuleService } from './fulfillment/service.js'
import type { IInventoryModuleService } from './inventory/service.js'
import type { ILinkService } from './link/service.js'
import type { Logger } from './logger.js'
import type { INotificationModuleService } from './notification/service.js'
import type { IOrderModuleService } from './order/service.js'
import type { IPaymentModuleService } from './payment/service.js'
import type { IPricingModuleService } from './pricing/service.js'
import type { IProductModuleService } from './product/service.js'
import type { IRegionModuleService } from './region/service.js'
import type { IStockLocationModuleService } from './stock-location/service.js'
import type { IStoreModuleService } from './store/service.js'
import type { IUserModuleService } from './user/service.js'

/**
 * What the shared container hands back for each `Modules` key. The module's own class is checked
 * against its entry here by `Module()`, so a public method that never reached the contract is a
 * type error at the module definition rather than something a caller discovers by reaching for it.
 */
export type ModuleServiceContracts = {
  [Modules.ACCESS_CONTROL]: IAccessControlModuleService
  [Modules.AUTH]: IAuthModuleService
  [Modules.CART]: ICartModuleService
  [Modules.CUSTOMER]: ICustomerModuleService
  [Modules.FILE]: IFileModuleService
  [Modules.FULFILLMENT]: IFulfillmentModuleService
  [Modules.INVENTORY]: IInventoryModuleService
  [Modules.NOTIFICATION]: INotificationModuleService
  [Modules.ORDER]: IOrderModuleService
  [Modules.PAYMENT]: IPaymentModuleService
  [Modules.PRICING]: IPricingModuleService
  [Modules.PRODUCT]: IProductModuleService
  [Modules.REGION]: IRegionModuleService
  [Modules.STOCK_LOCATION]: IStockLocationModuleService
  [Modules.STORE]: IStoreModuleService
  [Modules.USER]: IUserModuleService
}

/** What the shared container hands back for each `ContainerRegistrationKeys` key. */
type CoreRegistrationContracts = {
  [ContainerRegistrationKeys.CONFIG_MODULE]: ConfigModule
  [ContainerRegistrationKeys.DB_PROVIDER]: DbProvider
  [ContainerRegistrationKeys.EVENT_BUS]: EventBus
  [ContainerRegistrationKeys.GET_DB]: () => Database
  [ContainerRegistrationKeys.LINK]: ILinkService
  [ContainerRegistrationKeys.LOGGER]: Logger
}

type ContainerContracts = ModuleServiceContracts & CoreRegistrationContracts

/**
 * The shared container, with the key-to-contract mapping applied to `resolve`. Passing a `Modules`
 * or `ContainerRegistrationKeys` member is enough to get the type back, so no call site restates
 * it — and naming a type by hand is an error rather than an override, because a type argument has
 * to be a key: `resolve<IOrderModuleService>(Modules.PRODUCT)` does not compile.
 */
export type AppContainer = Omit<AwilixContainer, 'resolve' | 'createScope'> & {
  resolve<TKey extends keyof ContainerContracts>(key: TKey): ContainerContracts[TKey]
  createScope(): AppContainer
}

/**
 * A module's private container, which holds everything the shared one does plus the repositories
 * and provider instances that module registered for itself. Those keys are computed strings under
 * types `core/` has never seen, so the second signature takes the type argument the shared
 * container refuses — and that is the whole difference between the two.
 */
export type ModuleContainer = Omit<AppContainer, 'resolve' | 'createScope'> & {
  resolve<TKey extends keyof ContainerContracts>(key: TKey): ContainerContracts[TKey]
  resolve<TRegistration>(key: string): TRegistration
  createScope(): ModuleContainer
}
