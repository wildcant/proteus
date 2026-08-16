import { BaseRepository } from '../../../core/utils/base-repository.js'
import { priceSetTable } from '../models/price-set.js'

export class PriceSetRepository extends BaseRepository(priceSetTable) {}
