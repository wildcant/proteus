import { Module } from '../../core/utils/module.js'
import { Modules } from '../../core/utils/modules-definition.js'
import * as models from './models/index.js'
import { PriceRepository } from './repositories/price.js'
import { PriceSetRepository } from './repositories/price-set.js'
import { PricingModuleService } from './services/pricing-module-service.js'

export default Module(Modules.PRICING, {
  service: PricingModuleService,
  models,
  repositories: {
    priceSetRepository: PriceSetRepository,
    priceRepository: PriceRepository,
  },
})
