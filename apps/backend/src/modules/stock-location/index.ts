import { Module } from '../../core/utils/module.js'
import { Modules } from '../../core/utils/modules-definition.js'
import { stockLocationTable } from './models/stock-location.js'
import { StockLocationRepository } from './repositories/stock-location.js'
import { StockLocationModuleService } from './services/stock-location-module-service.js'

export default Module(Modules.STOCK_LOCATION, {
  service: StockLocationModuleService,
  models: {
    stockLocationTable,
  },
  repositories: {
    stockLocationRepository: StockLocationRepository,
  },
})
