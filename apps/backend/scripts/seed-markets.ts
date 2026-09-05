/**
 * Seed only the markets: regions, the ISO country table, the store, and each region's payment
 * providers.
 *
 * Usage: npx tsx scripts/seed-markets.ts
 *
 * The end-to-end database truncates every table between runs, and the storefront cannot render
 * without markets — its routable URL segments are the locale codes on sellable countries. This is
 * the smallest seed that gets it back, with none of the development seed's catalogue.
 */

import type {
  ILinkService,
  IPaymentModuleService,
  IRegionModuleService,
  IStoreModuleService,
} from '../src/core/types/index.js'
import { ContainerRegistrationKeys, Modules } from '../src/core/utils/index.js'
import { container } from '../src/framework/runtime/container.node.js'
import { seedMarkets } from './seed/markets.js'

await seedMarkets({
  regionService: container.resolve<IRegionModuleService>(Modules.REGION),
  storeService: container.resolve<IStoreModuleService>(Modules.STORE),
  paymentService: container.resolve<IPaymentModuleService>(Modules.PAYMENT),
  linkService: container.resolve<ILinkService>(ContainerRegistrationKeys.LINK),
})

process.exit(0)
