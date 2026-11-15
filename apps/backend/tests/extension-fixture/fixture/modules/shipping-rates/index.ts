import { Module } from '@core/utils/module.js'
import { FixtureModules } from '../../keys.js'
import { fixtureShippingRateTable } from './models/shipping-rate.js'
import { FixtureShippingRateRepository } from './repositories/shipping-rate.js'
import { FixtureShippingRatesModuleService } from './services/shipping-rates-module-service.js'

export default Module(FixtureModules.SHIPPING_RATES, {
  service: FixtureShippingRatesModuleService,
  models: { fixtureShippingRateTable },
  repositories: { fixtureShippingRateRepository: FixtureShippingRateRepository },
})
