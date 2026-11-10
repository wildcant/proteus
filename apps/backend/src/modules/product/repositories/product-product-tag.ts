import { and, asc, eq, inArray, isNull } from 'drizzle-orm'
import type { Context } from '../../../core/types/context.js'
import type { ProductTagDTO } from '../../../core/types/product/common.js'
import { BaseRepository } from '../../../core/utils/base-repository.js'
import { productProductTagTable } from '../models/product-product-tag.js'
import { productTagTable } from '../models/product-tag.js'

export class ProductProductTagRepository extends BaseRepository(productProductTagTable) {
  /**
   * The live Tags of every product in `productIds`, in one query. Both the pivot row and the Tag must
   * be live: a write checks the foreign key only, so a pivot can name a Tag that was soft-deleted since.
   */
  async findTagsOfProducts(
    productIds: string[],
    context?: Context,
  ): Promise<{ productId: string; tag: ProductTagDTO }[]> {
    if (productIds.length === 0) return []
    return this.getClient(context)
      .select({ productId: this.table.productId, tag: productTagTable })
      .from(this.table)
      .innerJoin(productTagTable, eq(productTagTable.id, this.table.tagId))
      .where(
        and(inArray(this.table.productId, productIds), isNull(this.table.deletedAt), isNull(productTagTable.deletedAt)),
      )
      .orderBy(asc(productTagTable.value), asc(productTagTable.id))
  }
}
