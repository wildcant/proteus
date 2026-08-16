import { and, inArray, isNull } from 'drizzle-orm'
import type { Context } from '../../core/types/context.js'
import { BaseRepository } from '../../core/utils/base-repository.js'
import { productVariantPriceSetTable } from '../definitions/product-variant-price-set.js'

export class ProductVariantPriceSetRepository extends BaseRepository(productVariantPriceSetTable) {
  async findByVariantIds(variantIds: string[], context?: Context) {
    if (variantIds.length === 0) return []
    const client = this.getClient(context)
    return client
      .select()
      .from(this.table)
      .where(and(inArray(this.table.variantId, variantIds), isNull(this.table.deletedAt)))
  }
}
