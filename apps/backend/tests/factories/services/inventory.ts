import type { AppContainer } from '../../../src/core/types/container.js'
import type {
  CreateInventoryItemDTO,
  CreateInventoryLevelDTO,
  CreateReservationItemDTO,
} from '../../../src/core/types/inventory/mutations.js'
import type { IInventoryModuleService } from '../../../src/core/types/inventory/service.js'
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
 * A variant the shop tracks and holds nothing of: an inventory item and the variant↔item link
 * `reserve-inventory` walks, with no level at any location.
 *
 * Separate from {@link stockVariant} rather than an option on it, because every other caller wants
 * the level and would otherwise have to prove it came back. This is the one arrangement checkout
 * refuses as invalid data.
 */
export async function trackVariantWithoutStock(container: AppContainer, options: Omit<StockVariantOptions, 'level'>) {
  const inventoryService = container.resolve(Modules.INVENTORY)
  const linkService = container.resolve(ContainerRegistrationKeys.LINK)

  const [inventoryItem] = await inventoryService.createInventoryItems([generateCreateInventoryItemDTO(options.item)])
  if (!inventoryItem) throw new Error('createInventoryItems returned no rows')

  await linkService.repo('productVariantInventoryItem').create({
    variantId: options.variantId,
    inventoryItemId: inventoryItem.id,
    requiredQuantity: options.requiredQuantity,
  })

  return { inventoryItem }
}

/**
 * Backs a variant with real stock: a Stock Location, an inventory item, a level holding it at that
 * location, and the variant↔item link that `reserve-inventory` walks. Without the link the
 * workflow silently reserves nothing, so all of it goes together.
 *
 * The location is created rather than faked because `reserve-inventory` resolves the id before it
 * writes a reservation — a minted `sloc_...` string would fail there, not here.
 */
export async function stockVariant(container: AppContainer, options: StockVariantOptions) {
  const { inventoryItem } = await trackVariantWithoutStock(container, options)
  const inventoryLevel = await addInventoryLevel(container, inventoryItem.id, options.level)

  return { inventoryItem, inventoryLevel }
}

/**
 * A second (or third) location holding the same inventory item. `stockVariant` creates one
 * level; coverage across several locations needs more, and they must share the item.
 */
export async function addInventoryLevel(
  container: AppContainer,
  inventoryItemId: string,
  overrides?: Partial<Omit<CreateInventoryLevelDTO, 'inventoryItemId'>>,
) {
  const inventoryService = container.resolve(Modules.INVENTORY)

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
  container: AppContainer,
  overrides: Pick<CreateReservationItemDTO, 'inventoryItemId' | 'locationId'> & Partial<CreateReservationItemDTO>,
) {
  const inventoryService = container.resolve(Modules.INVENTORY)

  const [reservation] = await inventoryService.createReservationItems([generateCreateReservationItemDTO(overrides)])
  if (!reservation) throw new Error('createReservationItems returned no rows')

  return reservation
}

/**
 * Moves what is on the shelf. The module takes an adjustment rather than an absolute, and the
 * level a variant is born with holds zero — so a test that needs units in stock adds them here.
 */
export async function adjustInventoryLevel(
  container: AppContainer,
  ...args: Parameters<IInventoryModuleService['adjustInventoryLevel']>
) {
  const inventoryService = container.resolve(Modules.INVENTORY)

  return inventoryService.adjustInventoryLevel(...args)
}

// ---- Reads ----

/** The Inventory Items themselves — the only read that can tell an item that was never created
 *  from one that untracking hid, which takes `{ withDeleted: true }`. */
export async function listInventoryItems(
  container: AppContainer,
  ...args: Parameters<IInventoryModuleService['listInventoryItems']>
) {
  const inventoryService = container.resolve(Modules.INVENTORY)

  return inventoryService.listInventoryItems(...args)
}

export async function listReservationItems(
  container: AppContainer,
  ...args: Parameters<IInventoryModuleService['listReservationItems']>
) {
  const inventoryService = container.resolve(Modules.INVENTORY)

  return inventoryService.listReservationItems(...args)
}

/** The level rows themselves, for the one number no other read exposes: `reservedQuantity`. */
export async function listInventoryLevels(
  container: AppContainer,
  ...args: Parameters<IInventoryModuleService['listInventoryLevels']>
) {
  const inventoryService = container.resolve(Modules.INVENTORY)

  return inventoryService.listInventoryLevels(...args)
}

/** Stocked minus reserved — what the storefront's `inStock` is derived from, and what an order
 *  in flight is supposed to take off the shelf. */
export async function retrieveAvailableQuantity(
  container: AppContainer,
  ...args: Parameters<IInventoryModuleService['retrieveAvailableQuantity']>
) {
  const inventoryService = container.resolve(Modules.INVENTORY)

  return inventoryService.retrieveAvailableQuantity(...args)
}
