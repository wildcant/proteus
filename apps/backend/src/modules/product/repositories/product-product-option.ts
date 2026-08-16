import { BaseRepository } from '../../../core/utils/base-repository.js'
import { productProductOptionTable } from '../models/product-product-option.js'

export class ProductProductOptionRepository extends BaseRepository(productProductOptionTable) {}
