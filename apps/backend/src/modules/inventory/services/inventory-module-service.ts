import { AppError, ErrorTypes } from '../../../core/errors/app-error.js'
import type {
  Context,
  CreateInventoryItemDTO,
  CreateInventoryLevelDTO,
  CreateReservationItemDTO,
  FilterableInventoryItemProps,
  FilterableInventoryLevelProps,
  FilterableReservationItemProps,
  FindConfig,
  IInventoryModuleService,
  InventoryItemDTO,
  InventoryLevelDTO,
  ReservationItemDTO,
  UpdateInventoryItemDTO,
} from '../../../core/types/index.js'
import type { Logger } from '../../../core/types/logger.js'
import type { WithTransaction } from '../../../core/utils/with-transaction.js'
import type { InventoryItemRepository } from '../repositories/inventory-item.js'
import type { InventoryLevelRepository } from '../repositories/inventory-level.js'
import type { ReservationItemRepository } from '../repositories/reservation-item.js'

type InjectedDependencies = {
  inventoryItemRepository: InventoryItemRepository
  inventoryLevelRepository: InventoryLevelRepository
  reservationItemRepository: ReservationItemRepository
  withTransaction: WithTransaction
  logger: Logger
}

export class InventoryModuleService implements IInventoryModuleService {
  private inventoryItemRepository: InventoryItemRepository
  private inventoryLevelRepository: InventoryLevelRepository
  private reservationItemRepository: ReservationItemRepository
  private withTransaction: WithTransaction
  private logger: Logger

  constructor({
    inventoryItemRepository,
    inventoryLevelRepository,
    reservationItemRepository,
    withTransaction,
    logger,
  }: InjectedDependencies) {
    this.inventoryItemRepository = inventoryItemRepository
    this.inventoryLevelRepository = inventoryLevelRepository
    this.reservationItemRepository = reservationItemRepository
    this.withTransaction = withTransaction
    this.logger = logger
  }

  async listInventoryItems(
    filters?: FilterableInventoryItemProps,
    config?: FindConfig<InventoryItemDTO>,
    context?: Context,
  ): Promise<InventoryItemDTO[]> {
    return this.inventoryItemRepository.find(filters, config, context)
  }

  async retrieveInventoryItem(
    itemId: string,
    config?: FindConfig<InventoryItemDTO>,
    context?: Context,
  ): Promise<InventoryItemDTO> {
    return this.inventoryItemRepository.findByIdOrFail(itemId, config, context)
  }

  async createInventoryItems(data: CreateInventoryItemDTO[], context?: Context): Promise<InventoryItemDTO[]> {
    this.logger.debug(`Creating ${data.length} inventory item(s)`)
    return this.withTransaction(context, async (ctx) => {
      return this.inventoryItemRepository.createMany(data, ctx)
    })
  }

  async updateInventoryItems(
    itemIds: string[],
    data: UpdateInventoryItemDTO,
    context?: Context,
  ): Promise<InventoryItemDTO[]> {
    return this.withTransaction(context, async (ctx) => {
      return this.inventoryItemRepository.updateMany(itemIds, data, ctx)
    })
  }

  async createInventoryItem(data: CreateInventoryItemDTO, context?: Context): Promise<InventoryItemDTO> {
    return this.withTransaction(context, async (ctx) => {
      return this.inventoryItemRepository.create(data, ctx)
    })
  }

  async updateInventoryItem(
    itemId: string,
    data: UpdateInventoryItemDTO,
    context?: Context,
  ): Promise<InventoryItemDTO> {
    return this.withTransaction(context, async (ctx) => {
      return this.inventoryItemRepository.update(itemId, data, ctx)
    })
  }

  async createInventoryLevel(data: CreateInventoryLevelDTO, context?: Context): Promise<InventoryLevelDTO> {
    return this.withTransaction(context, async (ctx) => {
      return this.inventoryLevelRepository.create(data, ctx)
    })
  }

  async softDeleteInventoryItems(itemIds: string[], context?: Context): Promise<void> {
    return this.withTransaction(context, async (ctx) => {
      await this.inventoryItemRepository.softDelete(itemIds, ctx)
    })
  }

  async listInventoryLevels(
    filters?: FilterableInventoryLevelProps,
    config?: FindConfig<InventoryLevelDTO>,
    context?: Context,
  ): Promise<InventoryLevelDTO[]> {
    return this.inventoryLevelRepository.find(filters, config, context)
  }

  async createInventoryLevels(data: CreateInventoryLevelDTO[], context?: Context): Promise<InventoryLevelDTO[]> {
    this.logger.debug(`Creating ${data.length} inventory level(s)`)
    return this.withTransaction(context, async (ctx) => {
      return this.inventoryLevelRepository.createMany(data, ctx)
    })
  }

  /**
   * Stocked minus reserved for one inventory item, summed across the given locations — or across
   * every location when `locationIds` is omitted. Zero when the item has no level.
   */
  async retrieveAvailableQuantity(inventoryItemId: string, locationIds?: string[], context?: Context): Promise<number> {
    const levels = await this.inventoryLevelRepository.find(
      { inventoryItemId, ...(locationIds ? { locationId: locationIds } : {}) },
      undefined,
      context,
    )

    return levels.reduce((sum, level) => sum + level.stockedQuantity - level.reservedQuantity, 0)
  }

  async confirmInventory(
    inventoryItemId: string,
    locationIds: string[],
    quantity: number,
    context?: Context,
  ): Promise<boolean> {
    return (await this.retrieveAvailableQuantity(inventoryItemId, locationIds, context)) >= quantity
  }

  async adjustInventoryLevel(
    inventoryItemId: string,
    locationId: string,
    adjustment: number,
    context?: Context,
  ): Promise<InventoryLevelDTO> {
    return this.withTransaction(context, async (ctx) => {
      const [level] = await this.inventoryLevelRepository.find({ inventoryItemId, locationId }, undefined, ctx)
      if (!level) {
        throw new AppError({
          type: ErrorTypes.NOT_FOUND,
          message: `Inventory level not found for item ${inventoryItemId} at location ${locationId}`,
        })
      }
      return this.inventoryLevelRepository.update(
        level.id,
        { stockedQuantity: level.stockedQuantity + adjustment },
        ctx,
      )
    })
  }

  async createReservationItems(data: CreateReservationItemDTO[], context?: Context): Promise<ReservationItemDTO[]> {
    this.logger.debug(`Creating ${data.length} reservation item(s)`)
    return this.withTransaction(context, async (ctx) => {
      return this.reservationItemRepository.createMany(data, ctx)
    })
  }

  async softDeleteReservationItems(ids: string[], context?: Context): Promise<void> {
    return this.withTransaction(context, async (ctx) => {
      await this.reservationItemRepository.softDelete(ids, ctx)
    })
  }

  async restoreReservationItems(ids: string[], context?: Context): Promise<void> {
    return this.withTransaction(context, async (ctx) => {
      await this.reservationItemRepository.restore(ids, ctx)
    })
  }

  async listReservationItems(
    filters?: FilterableReservationItemProps,
    config?: FindConfig<ReservationItemDTO>,
    context?: Context,
  ): Promise<ReservationItemDTO[]> {
    return this.reservationItemRepository.find(filters, config, context)
  }
}
