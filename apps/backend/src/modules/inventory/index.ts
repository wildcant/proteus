import { Module } from '../../core/utils/module.js'
import { Modules } from '../../core/utils/modules-definition.js'
import { inventoryItemTable } from './models/inventory-item.js'
import { inventoryLevelTable } from './models/inventory-level.js'
import { reservationItemTable } from './models/reservation-item.js'
import { InventoryItemRepository } from './repositories/inventory-item.js'
import { InventoryLevelRepository } from './repositories/inventory-level.js'
import { ReservationItemRepository } from './repositories/reservation-item.js'
import { InventoryModuleService } from './services/inventory-module-service.js'

export default Module(Modules.INVENTORY, {
  service: InventoryModuleService,
  models: {
    inventoryItemTable,
    inventoryLevelTable,
    reservationItemTable,
  },
  repositories: {
    inventoryItemRepository: InventoryItemRepository,
    inventoryLevelRepository: InventoryLevelRepository,
    reservationItemRepository: ReservationItemRepository,
  },
})
