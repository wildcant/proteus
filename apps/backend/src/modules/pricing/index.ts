import { Module } from '../../core/utils/module.js'
import { Modules } from '../../core/utils/modules-definition.js'
import { PriceRepository } from './repositories/price.js'
import { PriceSetRepository } from './repositories/price-set.js'
import { PricingModuleService } from './services/pricing-module-service.js'

export default Module(Modules.PRICING, {
  service: PricingModuleService,
  repositories: {
    priceSetRepository: PriceSetRepository,
    priceRepository: PriceRepository,
  },
})
