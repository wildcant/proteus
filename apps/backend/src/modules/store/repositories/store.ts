import { BaseRepository } from '../../../core/utils/base-repository.js'
import { storeTable } from '../models/store.js'

export class StoreRepository extends BaseRepository(storeTable) {}
