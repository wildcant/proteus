import { BaseRepository } from '../../../core/utils/base-repository.js'
import { productOptionValueBucketTable } from '../models/product-option-value-bucket.js'

export class ProductOptionValueBucketRepository extends BaseRepository(productOptionValueBucketTable) {}
