import type { FindConfig } from '../common.js'
import type { Context } from '../context.js'
import type { FilterableStockLocationProps, StockLocationDTO } from './common.js'
import type { CreateStockLocationDTO, UpdateStockLocationDTO } from './mutations.js'

export type IStockLocationModuleService = {
  listStockLocations(
    filters?: FilterableStockLocationProps,
    config?: FindConfig<StockLocationDTO>,
    context?: Context,
  ): Promise<StockLocationDTO[]>
  retrieveStockLocation(
    stockLocationId: string,
    config?: FindConfig<StockLocationDTO>,
    context?: Context,
  ): Promise<StockLocationDTO>
  createStockLocation(data: CreateStockLocationDTO, context?: Context): Promise<StockLocationDTO>
  /** Renaming is the only edit a location has, and the only way to make one: there is no screen. */
  updateStockLocations(
    stockLocationIds: string[],
    data: UpdateStockLocationDTO,
    context?: Context,
  ): Promise<StockLocationDTO[]>
  /**
   * The locations these ids name, in the order they were asked for.
   *
   * An Inventory Level and a Reservation each carry their `locationId` as plain text with no
   * foreign key, because the column crosses a module boundary (ADR-0002, ADR-0004). This stands in
   * for the constraint the database cannot hold: a caller resolves the ids before it writes either
   * row, so a location that does not exist fails at the write rather than silently at fulfillment.
   *
   * An id naming no location is invalid data rather than a missing resource — the caller asked to
   * write a row against it, and the answer is that the row it wanted is not writable.
   */
  resolveStockLocations(stockLocationIds: string[], context?: Context): Promise<StockLocationDTO[]>
}
