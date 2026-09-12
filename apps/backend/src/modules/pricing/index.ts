import { Module } from '../../core/utils/module.js'
import { Modules } from '../../core/utils/modules-definition.js'
import { priceTable } from './models/price.js'
import { priceSetTable } from './models/price-set.js'
import { PriceRepository } from './repositories/price.js'
import { PriceSetRepository } from './repositories/price-set.js'
import { PricingModuleService } from './services/pricing-module-service.js'

export default Module(Modules.PRICING, {
  service: PricingModuleService,
  models: {
    priceSetTable,
    priceTable,
  },
  repositories: {
    priceSetRepository: PriceSetRepository,
    priceRepository: PriceRepository,
  },
})
