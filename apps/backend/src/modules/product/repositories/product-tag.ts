import { BaseRepository } from '../../../core/utils/base-repository.js'
import { productTagTable } from '../models/product-tag.js'

export class ProductTagRepository extends BaseRepository(productTagTable) {}
