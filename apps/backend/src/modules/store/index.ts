import { Module } from '../../core/utils/module.js'
import { Modules } from '../../core/utils/modules-definition.js'
import { storeTable } from './models/store.js'
import { storeCurrencyTable } from './models/store-currency.js'
import { StoreRepository } from './repositories/store.js'
import { StoreCurrencyRepository } from './repositories/store-currency.js'
import { StoreModuleService } from './services/store-module-service.js'

export default Module(Modules.STORE, {
  service: StoreModuleService,
  features: [
    { id: 'store.read', title: 'View store settings' },
    { id: 'store.update', title: 'Edit store settings' },
  ],
  models: {
    storeCurrencyTable,
    storeTable,
  },
  repositories: {
    storeRepository: StoreRepository,
    storeCurrencyRepository: StoreCurrencyRepository,
  },
})
