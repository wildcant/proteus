import type { AwilixContainer } from 'awilix'
import type { CreateStockLocationDTO } from '../../../src/core/types/stock-location/mutations.js'
import type { IStockLocationModuleService } from '../../../src/core/types/stock-location/service.js'
import { Modules } from '../../../src/core/utils/modules-definition.js'
import { generateCreateStockLocationDTO } from '../stock-location-dto.js'

/**
 * A location a level or a reservation can name. The shop ships with one, created by the seed, but
 * a test gets its own: nothing here resolves a location by name, so a second one collides with
 * nothing, and a test that needs two locations for one item can ask twice.
 */
export async function createStockLocation(container: AwilixContainer, overrides?: Partial<CreateStockLocationDTO>) {
  const stockLocationService = container.resolve<IStockLocationModuleService>(Modules.STOCK_LOCATION)

  return stockLocationService.createStockLocation(generateCreateStockLocationDTO(overrides))
}
