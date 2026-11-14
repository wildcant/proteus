import { BaseRepository } from '../../../core/utils/base-repository.js'
import { productOptionBucketTable } from '../models/product-option-bucket.js'

export class ProductOptionBucketRepository extends BaseRepository(productOptionBucketTable) {}
