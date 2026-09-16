import { AppError, ErrorTypes } from '@core/errors/app-error.js'
import { test } from '@tests/setup/test-extend.js'
import { buildCascadeGraph } from '../../../core/db/cascade-graph.js'
import { createWithTransaction } from '../../../core/utils/with-transaction.js'
import stockLocationModule from '../index.js'
import { StockLocationRepository } from '../repositories/stock-location.js'
import { StockLocationModuleService } from '../services/stock-location-module-service.js'

const cascadeGraph = buildCascadeGraph(stockLocationModule.models)

let service: StockLocationModuleService

test.beforeEach(({ getDb }) => {
  service = new StockLocationModuleService({
    stockLocationRepository: new StockLocationRepository({ getDb, cascadeGraph }),
    withTransaction: createWithTransaction(getDb),
  })
})

test.describe('StockLocationModuleService', () => {
  test('creates a location, retrieves it, and renames it', async ({ expect }) => {
    const created = await service.createStockLocation({ name: 'Main Warehouse' })

    expect(created.id).toMatch(/^sloc_/)
    expect(await service.retrieveStockLocation(created.id)).toMatchObject({ id: created.id, name: 'Main Warehouse' })

    // Renaming is the whole of a location's editing: there is no screen that would create a second.
    await service.updateStockLocations([created.id], { name: 'Lisbon Warehouse' })

    expect((await service.retrieveStockLocation(created.id)).name).toBe('Lisbon Warehouse')
  })

  test.describe('resolveStockLocations', () => {
    test('returns the locations the ids name, in the order they were asked for', async ({ expect }) => {
      const first = await service.createStockLocation({ name: 'Main Warehouse' })
      const second = await service.createStockLocation({ name: 'Overflow Warehouse' })

      const resolved = await service.resolveStockLocations([second.id, first.id])

      // Both exist, so answering with every location would satisfy an id-set assertion. Asking in
      // the reverse of creation order is what makes this one specific to the argument.
      expect(resolved.map((location) => location.id)).toEqual([second.id, first.id])
      expect(resolved.map((location) => location.name)).toEqual(['Overflow Warehouse', 'Main Warehouse'])
    })

    test('rejects an id that names no location, and names that id', async ({ expect }) => {
      // A real location beside the bad id, so resolution cannot pass merely because something did.
      const known = await service.createStockLocation({ name: 'Main Warehouse' })

      const error = await service.resolveStockLocations([known.id, 'sloc_typo']).catch((e) => e)

      expect(AppError.isError(error)).toBe(true)
      expect(error.type).toBe(ErrorTypes.INVALID_DATA)
      expect(error.message).toContain('sloc_typo')
      expect(error.message).not.toContain(known.id)
    })
  })
})
