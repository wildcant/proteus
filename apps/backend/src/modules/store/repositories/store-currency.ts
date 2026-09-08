import { BaseRepository } from '../../../core/utils/base-repository.js'
import { storeCurrencyTable } from '../models/store-currency.js'

export class StoreCurrencyRepository extends BaseRepository(storeCurrencyTable) {}
