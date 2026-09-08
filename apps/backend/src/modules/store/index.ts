import { Module } from '../../core/utils/module.js'
import { Modules } from '../../core/utils/modules-definition.js'
import * as models from './models/index.js'
import { StoreRepository } from './repositories/store.js'
import { StoreCurrencyRepository } from './repositories/store-currency.js'
import { StoreModuleService } from './services/store-module-service.js'

export default Module(Modules.STORE, {
  service: StoreModuleService,
  models,
  repositories: {
    storeRepository: StoreRepository,
    storeCurrencyRepository: StoreCurrencyRepository,
  },
})
