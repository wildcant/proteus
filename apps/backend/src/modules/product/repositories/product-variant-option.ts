import { BaseRepository } from '../../../core/utils/base-repository.js'
import { productVariantOptionTable } from '../models/product-variant-option.js'

export class ProductVariantOptionRepository extends BaseRepository(productVariantOptionTable) {}
