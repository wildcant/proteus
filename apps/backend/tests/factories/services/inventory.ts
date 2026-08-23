import type { AwilixContainer } from 'awilix'
import type { CreateInventoryItemDTO, CreateInventoryLevelDTO } from '../../../src/core/types/inventory/mutations.js'
import type { IInventoryModuleService } from '../../../src/core/types/inventory/service.js'
import type { ILinkService } from '../../../src/core/types/link/service.js'
import { ContainerRegistrationKeys, Modules } from '../../../src/core/utils/index.js'
import { generateCreateInventoryItemDTO, generateCreateInventoryLevelDTO } from '../inventory-dto.js'

export type StockVariantOptions = {
  variantId: string
  item?: Partial<CreateInventoryItemDTO>
  level?: Partial<Omit<CreateInventoryLevelDTO, 'inventoryItemId'>>
  /** Units of stock consumed per unit ordered. Omitted means the column default of 1. */
  requiredQuantity?: number
}

/**
 * Backs a variant with real stock: inventory item, a level holding it, and the
 * variant↔item link that `reserve-inventory` walks. Without the link the workflow
 * silently reserves nothing, so all three go together.
 */
export async function stockVariant(container: AwilixContainer, options: StockVariantOptions) {
  const inventoryService = container.resolve<IInventoryModuleService>(Modules.INVENTORY)
  const linkService = container.resolve<ILinkService>(ContainerRegistrationKeys.LINK)

  const [inventoryItem] = await inventoryService.createInventoryItems([generateCreateInventoryItemDTO(options.item)])
  if (!inventoryItem) throw new Error('createInventoryItems returned no rows')

  const [inventoryLevel] = await inventoryService.createInventoryLevels([
    generateCreateInventoryLevelDTO({ ...options.level, inventoryItemId: inventoryItem.id }),
  ])
  if (!inventoryLevel) throw new Error('createInventoryLevels returned no rows')

  await linkService.repo('productVariantInventoryItem').create({
    variantId: options.variantId,
    inventoryItemId: inventoryItem.id,
    requiredQuantity: options.requiredQuantity,
  })

  return { inventoryItem, inventoryLevel }
}

// ---- Reads ----

export async function listReservationItems(
  container: AwilixContainer,
  ...args: Parameters<IInventoryModuleService['listReservationItems']>
) {
  const inventoryService = container.resolve<IInventoryModuleService>(Modules.INVENTORY)

  return inventoryService.listReservationItems(...args)
}
