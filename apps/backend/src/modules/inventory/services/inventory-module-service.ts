import { AppError, ErrorTypes } from '../../../core/errors/app-error.js'
import type { FindConfig } from '../../../core/types/common.js'
import type { Context } from '../../../core/types/context.js'
import type {
  FilterableInventoryItemProps,
  FilterableInventoryLevelProps,
  FilterableReservationItemProps,
  InventoryItemDTO,
  InventoryLevelDTO,
  ReservationItemDTO,
} from '../../../core/types/inventory/common.js'
import type {
  CreateInventoryItemDTO,
  CreateInventoryLevelDTO,
  CreateReservationItemDTO,
  UpdateInventoryItemDTO,
} from '../../../core/types/inventory/mutations.js'
import type { IInventoryModuleService } from '../../../core/types/inventory/service.js'
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

  /**
   * Brings back exactly what the matching soft delete hid — the item, its levels and the stock
   * they hold. This is what makes untracking a variant a reversible act rather than a destructive
   * one; nothing else calls it.
   */
  async restoreInventoryItems(itemIds: string[], context?: Context): Promise<void> {
    return this.withTransaction(context, async (ctx) => {
      await this.inventoryItemRepository.restore(itemIds, ctx)
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
      return this.inventoryLevelRepository.updateBumpingVersion(
        level.id,
        { stockedQuantity: level.stockedQuantity + adjustment },
        ctx,
      )
    })
  }

  /**
   * Replaces the physical shelf count while preserving the units already committed to orders.
   * The check and write share one transaction, so the route cannot accidentally make Available
   * Quantity negative by setting Stocked Quantity below the maintained reservation counter.
   */
  async setInventoryLevelStockedQuantity(
    inventoryItemId: string,
    locationId: string,
    stockedQuantity: number,
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
      if (stockedQuantity < level.reservedQuantity) {
        throw new AppError({
          type: ErrorTypes.NOT_ALLOWED,
          message: `Stocked Quantity cannot be set to ${stockedQuantity}: ${level.reservedQuantity} unit(s) are reserved. Set it to at least ${level.reservedQuantity}.`,
        })
      }

      return this.inventoryLevelRepository.updateBumpingVersion(level.id, { stockedQuantity }, ctx)
    })
  }

  /**
   * Writes reservations and moves `reservedQuantity` by the same amount in the same transaction,
   * which is what makes available quantity reflect orders in flight rather than the column default.
   *
   * Two guards, in order: every item/location pair needs a level row, and — unless the reservation
   * allows backorder — available quantity has to cover what is asked for. Backorder skips only the
   * second; it still needs the level, which is what guarantees the fulfillment adjustment is never
   * handed a location it cannot find.
   *
   * Reading the level and writing the sum back is not atomic, so two concurrent reservations can
   * both take the last unit. That is proved by a deliberately failing test rather than fixed here —
   * locking is its own item.
   */
  async createReservationItems(data: CreateReservationItemDTO[], context?: Context): Promise<ReservationItemDTO[]> {
    if (data.length === 0) return []

    this.logger.debug(`Creating ${data.length} reservation item(s)`)
    return this.withTransaction(context, async (ctx) => {
      const levels = await this.findLevelsFor(data, ctx)
      this.assertEveryPairHasALevel(data, levels)
      this.assertCoverage(data, levels)

      const created = await this.reservationItemRepository.createMany(data, ctx)
      await this.moveReservedQuantity(data, levels, 1, ctx)

      return created
    })
  }

  /** Releases the reservations that are still live, so a repeated release subtracts once. */
  async softDeleteReservationItems(ids: string[], context?: Context): Promise<void> {
    if (ids.length === 0) return

    return this.withTransaction(context, async (ctx) => {
      const released = await this.reservationItemRepository.find({ id: ids }, undefined, ctx)
      await this.reservationItemRepository.softDelete(ids, ctx)

      const levels = await this.findLevelsFor(released, ctx)
      await this.moveReservedQuantity(released, levels, -1, ctx)
    })
  }

  /** Re-reserves only the ones that were actually hidden, so a repeated restore adds once. */
  async restoreReservationItems(ids: string[], context?: Context): Promise<void> {
    if (ids.length === 0) return

    return this.withTransaction(context, async (ctx) => {
      const rows = await this.reservationItemRepository.find({ id: ids }, { withDeleted: true }, ctx)
      const reReserved = rows.filter((row) => row.deletedAt !== null)
      await this.reservationItemRepository.restore(ids, ctx)

      const levels = await this.findLevelsFor(reReserved, ctx)
      await this.moveReservedQuantity(reReserved, levels, 1, ctx)
    })
  }

  async listReservationItems(
    filters?: FilterableReservationItemProps,
    config?: FindConfig<ReservationItemDTO>,
    context?: Context,
  ): Promise<ReservationItemDTO[]> {
    return this.reservationItemRepository.find(filters, config, context)
  }

  /** The same read a page needs, with the total the pager has to show beside it. */
  async listAndCountReservationItems(
    filters?: FilterableReservationItemProps,
    config?: FindConfig<ReservationItemDTO>,
    context?: Context,
  ): Promise<[ReservationItemDTO[], number]> {
    return this.reservationItemRepository.findAndCount(filters, config, context)
  }

  /** The level rows behind these reservations, keyed by the item/location pair they name. */
  private async findLevelsFor(
    rows: { inventoryItemId: string; locationId: string }[],
    context: Context,
  ): Promise<Map<string, InventoryLevelDTO>> {
    if (rows.length === 0) return new Map()

    const levels = await this.inventoryLevelRepository.find(
      { inventoryItemId: [...new Set(rows.map((row) => row.inventoryItemId))] },
      undefined,
      context,
    )

    return new Map(levels.map((level) => [levelKey(level), level]))
  }

  private assertEveryPairHasALevel(
    rows: { inventoryItemId: string; locationId: string }[],
    levels: Map<string, InventoryLevelDTO>,
  ): void {
    const missing = [...new Map(rows.map((row) => [levelKey(row), row])).values()].filter(
      (row) => !levels.has(levelKey(row)),
    )
    if (missing.length === 0) return

    throw new AppError({
      type: ErrorTypes.NOT_FOUND,
      message: missing
        .map((row) => `Inventory level not found for item ${row.inventoryItemId} at location ${row.locationId}`)
        .join('; '),
    })
  }

  /**
   * Demand is summed per level before it is compared, so two reservations for the same item at the
   * same location cannot each pass a check the pair of them fails. Backordered rows are left out:
   * the flag is what says this reservation may go past what is on the shelf.
   */
  private assertCoverage(data: CreateReservationItemDTO[], levels: Map<string, InventoryLevelDTO>): void {
    const demand = new Map<string, number>()
    for (const row of data) {
      if (row.allowBackorder) continue
      demand.set(levelKey(row), (demand.get(levelKey(row)) ?? 0) + row.quantity)
    }

    for (const [key, quantity] of demand) {
      const level = levels.get(key)
      if (!level) continue

      const available = level.stockedQuantity - level.reservedQuantity
      if (available >= quantity) continue

      throw new AppError({
        type: ErrorTypes.NOT_ALLOWED,
        message: `Not enough stock to reserve ${quantity} of item ${level.inventoryItemId} at location ${level.locationId}: ${available} available`,
      })
    }
  }

  /**
   * Moves the counter for every level the given reservations name.
   *
   * A pair with no level is skipped rather than raised, and that asymmetry is deliberate. On the
   * create path it cannot happen — `assertEveryPairHasALevel` runs first — so the skip only ever
   * describes a release: a reservation whose level row has gone between the reservation being
   * written and being released. Releasing has to finish anyway. Refusing would strand the units
   * *and* block the cancellation or fulfillment that was releasing them, which is worse than a
   * counter that has nothing left to move. It is logged at warn rather than passed over in silence,
   * because the two rows disagreeing is a data fault somebody has to look at — nothing deletes a
   * level today, so this line firing at all means something new does.
   */
  private async moveReservedQuantity(
    rows: { inventoryItemId: string; locationId: string; quantity: number }[],
    levels: Map<string, InventoryLevelDTO>,
    sign: 1 | -1,
    context: Context,
  ): Promise<void> {
    const moved = new Map<string, number>()
    for (const row of rows) {
      moved.set(levelKey(row), (moved.get(levelKey(row)) ?? 0) + row.quantity)
    }

    for (const [key, quantity] of moved) {
      const level = levels.get(key)
      if (!level) {
        this.logger.warn(
          `Reserved quantity not moved by ${sign * quantity}: no inventory level for ${key}. A reservation names an item and location that has no level row.`,
        )
        continue
      }

      await this.inventoryLevelRepository.updateBumpingVersion(
        level.id,
        { reservedQuantity: level.reservedQuantity + sign * quantity },
        context,
      )
    }
  }
}

/** An inventory level is identified by its item and its location, never by one of them alone. */
function levelKey(row: { inventoryItemId: string; locationId: string }): string {
  return `${row.inventoryItemId}@${row.locationId}`
}
