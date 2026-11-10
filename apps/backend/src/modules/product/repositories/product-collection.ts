import { BaseRepository } from '../../../core/utils/base-repository.js'
import { productCollectionTable } from '../models/product-collection.js'

export class ProductCollectionRepository extends BaseRepository(productCollectionTable) {}
