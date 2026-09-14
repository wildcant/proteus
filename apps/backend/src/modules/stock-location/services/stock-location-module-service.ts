import { AppError, ErrorTypes } from '../../../core/errors/app-error.js'
import type { FindConfig } from '../../../core/types/common.js'
import type { Context } from '../../../core/types/context.js'
import type { FilterableStockLocationProps, StockLocationDTO } from '../../../core/types/stock-location/common.js'
import type { CreateStockLocationDTO, UpdateStockLocationDTO } from '../../../core/types/stock-location/mutations.js'
import type { IStockLocationModuleService } from '../../../core/types/stock-location/service.js'
import type { WithTransaction } from '../../../core/utils/with-transaction.js'
import type { StockLocationRepository } from '../repositories/stock-location.js'

type InjectedDependencies = {
  stockLocationRepository: StockLocationRepository
  withTransaction: WithTransaction
}

export class StockLocationModuleService implements IStockLocationModuleService {
  private stockLocationRepository: StockLocationRepository
  private withTransaction: WithTransaction

  constructor({ stockLocationRepository, withTransaction }: InjectedDependencies) {
    this.stockLocationRepository = stockLocationRepository
    this.withTransaction = withTransaction
  }

  async listStockLocations(
    filters?: FilterableStockLocationProps,
    config?: FindConfig<StockLocationDTO>,
    context?: Context,
  ): Promise<StockLocationDTO[]> {
    return this.stockLocationRepository.find(filters, config, context)
  }

  async retrieveStockLocation(
    stockLocationId: string,
    config?: FindConfig<StockLocationDTO>,
    context?: Context,
  ): Promise<StockLocationDTO> {
    return this.stockLocationRepository.findByIdOrFail(stockLocationId, config, context)
  }

  async createStockLocation(data: CreateStockLocationDTO, context?: Context): Promise<StockLocationDTO> {
    return this.withTransaction(context, async (ctx) => this.stockLocationRepository.create(data, ctx))
  }

  async updateStockLocations(
    stockLocationIds: string[],
    data: UpdateStockLocationDTO,
    context?: Context,
  ): Promise<StockLocationDTO[]> {
    return this.withTransaction(context, async (ctx) =>
      this.stockLocationRepository.updateMany(stockLocationIds, data, ctx),
    )
  }

  /**
   * Resolving every id in one read rather than one retrieve per id: the caller is about to write a
   * batch of levels or reservations, and it wants to know about all the bad ids before it writes
   * any of the good ones.
   */
  async resolveStockLocations(stockLocationIds: string[], context?: Context): Promise<StockLocationDTO[]> {
    const asked = [...new Set(stockLocationIds)]
    if (!asked.length) return []

    const found = await this.stockLocationRepository.find({ id: asked }, undefined, context)
    const byId = new Map(found.map((location) => [location.id, location]))

    const unknown = asked.filter((id) => !byId.has(id))
    if (unknown.length) {
      throw new AppError({
        type: ErrorTypes.INVALID_DATA,
        message: `Unknown stock location ${unknown.length === 1 ? 'id' : 'ids'}: ${unknown
          .map((id) => `"${id}"`)
          .join(', ')}`,
      })
    }

    return stockLocationIds.flatMap((id) => byId.get(id) ?? [])
  }
}
