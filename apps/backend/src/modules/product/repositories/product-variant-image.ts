import { BaseRepository } from '../../../core/utils/base-repository.js'
import { productVariantImageTable } from '../models/product-variant-image.js'

export class ProductVariantImageRepository extends BaseRepository(productVariantImageTable) {}
