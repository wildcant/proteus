import { BaseRepository } from '../../../core/utils/base-repository.js'
import { stockLocationTable } from '../models/stock-location.js'

export class StockLocationRepository extends BaseRepository(stockLocationTable) {}
