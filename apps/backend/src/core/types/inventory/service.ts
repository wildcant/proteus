import type { FindConfig } from '../common.js'
import type { Context } from '../context.js'
import type {
  FilterableInventoryItemProps,
  FilterableInventoryLevelProps,
  FilterableReservationItemProps,
  InventoryItemDTO,
  InventoryLevelDTO,
  ReservationItemDTO,
} from './common.js'
import type {
  CreateInventoryItemDTO,
  CreateInventoryLevelDTO,
  CreateReservationItemDTO,
  UpdateInventoryItemDTO,
} from './mutations.js'

export type IInventoryModuleService = {
  listInventoryItems(
    filters?: FilterableInventoryItemProps,
    config?: FindConfig<InventoryItemDTO>,
    context?: Context,
  ): Promise<InventoryItemDTO[]>
  retrieveInventoryItem(
    itemId: string,
    config?: FindConfig<InventoryItemDTO>,
    context?: Context,
  ): Promise<InventoryItemDTO>
  createInventoryItems(data: CreateInventoryItemDTO[], context?: Context): Promise<InventoryItemDTO[]>
  updateInventoryItems(itemIds: string[], data: UpdateInventoryItemDTO, context?: Context): Promise<InventoryItemDTO[]>
  createInventoryItem(data: CreateInventoryItemDTO, context?: Context): Promise<InventoryItemDTO>
  updateInventoryItem(itemId: string, data: UpdateInventoryItemDTO, context?: Context): Promise<InventoryItemDTO>
  createInventoryLevel(data: CreateInventoryLevelDTO, context?: Context): Promise<InventoryLevelDTO>
  deleteInventoryItems(itemIds: string[], context?: Context): Promise<void>
  listInventoryLevels(
    filters?: FilterableInventoryLevelProps,
    config?: FindConfig<InventoryLevelDTO>,
    context?: Context,
  ): Promise<InventoryLevelDTO[]>
  createInventoryLevels(data: CreateInventoryLevelDTO[], context?: Context): Promise<InventoryLevelDTO[]>
  confirmInventory(
    inventoryItemId: string,
    locationIds: string[],
    quantity: number,
    context?: Context,
  ): Promise<boolean>
  createReservationItems(data: CreateReservationItemDTO[], context?: Context): Promise<ReservationItemDTO[]>
  deleteReservationItems(ids: string[], context?: Context): Promise<void>
  listReservationItems(
    filters?: FilterableReservationItemProps,
    config?: FindConfig<ReservationItemDTO>,
    context?: Context,
  ): Promise<ReservationItemDTO[]>
}
