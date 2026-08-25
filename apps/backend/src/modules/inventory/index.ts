import { Module } from '../../core/utils/module.js'
import { Modules } from '../../core/utils/modules-definition.js'
import * as models from './models/index.js'
import { InventoryItemRepository } from './repositories/inventory-item.js'
import { InventoryLevelRepository } from './repositories/inventory-level.js'
import { ReservationItemRepository } from './repositories/reservation-item.js'
import { InventoryModuleService } from './services/inventory-module-service.js'

export default Module(Modules.INVENTORY, {
  service: InventoryModuleService,
  models,
  repositories: {
    inventoryItemRepository: InventoryItemRepository,
    inventoryLevelRepository: InventoryLevelRepository,
    reservationItemRepository: ReservationItemRepository,
  },
})
