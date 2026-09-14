import type { AwilixContainer } from 'awilix'
import type {
  CreateInventoryItemDTO,
  CreateInventoryLevelDTO,
  CreateReservationItemDTO,
} from '../../../src/core/types/inventory/mutations.js'
import type { IInventoryModuleService } from '../../../src/core/types/inventory/service.js'
import type { ILinkService } from '../../../src/core/types/link/service.js'
import { ContainerRegistrationKeys } from '../../../src/core/utils/container.js'
import { Modules } from '../../../src/core/utils/modules-definition.js'
import {
  generateCreateInventoryItemDTO,
  generateCreateInventoryLevelDTO,
  generateCreateReservationItemDTO,
} from '../inventory-dto.js'
import { createStockLocation } from './stock-location.js'

export type StockVariantOptions = {
  variantId: string
  item?: Partial<CreateInventoryItemDTO>
  level?: Partial<Omit<CreateInventoryLevelDTO, 'inventoryItemId'>>
  /** Units of stock consumed per unit ordered. Omitted means the column default of 1. */
  requiredQuantity?: number
}

/**
 * Backs a variant with real stock: a Stock Location, an inventory item, a level holding it at that
 * location, and the variant↔item link that `reserve-inventory` walks. Without the link the
 * workflow silently reserves nothing, so all of it goes together.
 *
 * The location is created rather than faked because `reserve-inventory` resolves the id before it
 * writes a reservation — a minted `sloc_...` string would fail there, not here.
 */
export async function stockVariant(container: AwilixContainer, options: StockVariantOptions) {
  const inventoryService = container.resolve<IInventoryModuleService>(Modules.INVENTORY)
  const linkService = container.resolve<ILinkService>(ContainerRegistrationKeys.LINK)

  const [inventoryItem] = await inventoryService.createInventoryItems([generateCreateInventoryItemDTO(options.item)])
  if (!inventoryItem) throw new Error('createInventoryItems returned no rows')

  const locationId = options.level?.locationId ?? (await createStockLocation(container)).id

  const [inventoryLevel] = await inventoryService.createInventoryLevels([
    generateCreateInventoryLevelDTO({ ...options.level, locationId, inventoryItemId: inventoryItem.id }),
  ])
  if (!inventoryLevel) throw new Error('createInventoryLevels returned no rows')

  await linkService.repo('productVariantInventoryItem').create({
    variantId: options.variantId,
    inventoryItemId: inventoryItem.id,
    requiredQuantity: options.requiredQuantity,
  })

  return { inventoryItem, inventoryLevel }
}

/**
 * A second (or third) location holding the same inventory item. `stockVariant` creates one
 * level; coverage across several locations needs more, and they must share the item.
 */
export async function addInventoryLevel(
  container: AwilixContainer,
  inventoryItemId: string,
  overrides?: Partial<Omit<CreateInventoryLevelDTO, 'inventoryItemId'>>,
) {
  const inventoryService = container.resolve<IInventoryModuleService>(Modules.INVENTORY)

  const locationId = overrides?.locationId ?? (await createStockLocation(container)).id

  const [inventoryLevel] = await inventoryService.createInventoryLevels([
    generateCreateInventoryLevelDTO({ ...overrides, locationId, inventoryItemId }),
  ])
  if (!inventoryLevel) throw new Error('createInventoryLevels returned no rows')

  return inventoryLevel
}

/**
 * Stock committed to something, which is the only way `reservedQuantity` moves. A test that wants
 * a level with units already spoken for reserves them; the create DTO cannot set the counter.
 */
export async function reserveStock(
  container: AwilixContainer,
  overrides: Pick<CreateReservationItemDTO, 'inventoryItemId' | 'locationId'> & Partial<CreateReservationItemDTO>,
) {
  const inventoryService = container.resolve<IInventoryModuleService>(Modules.INVENTORY)

  const [reservation] = await inventoryService.createReservationItems([generateCreateReservationItemDTO(overrides)])
  if (!reservation) throw new Error('createReservationItems returned no rows')

  return reservation
}

// ---- Reads ----

export async function listReservationItems(
  container: AwilixContainer,
  ...args: Parameters<IInventoryModuleService['listReservationItems']>
) {
  const inventoryService = container.resolve<IInventoryModuleService>(Modules.INVENTORY)

  return inventoryService.listReservationItems(...args)
}
