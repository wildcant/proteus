import { and, asc, eq, inArray, isNull } from 'drizzle-orm'
import type { Context } from '../../../core/types/context.js'
import type { ProductCollectionDTO } from '../../../core/types/product/common.js'
import { BaseRepository } from '../../../core/utils/base-repository.js'
import { productCollectionTable } from '../models/product-collection.js'
import { productProductCollectionTable } from '../models/product-product-collection.js'

export class ProductProductCollectionRepository extends BaseRepository(productProductCollectionTable) {
  /**
   * The live Collections of every product in `productIds`, in one query. Both the pivot row and the
   * Collection must be live: a write checks the foreign key only, so a pivot can name a Collection
   * that was soft-deleted since.
   */
  async findCollectionsOfProducts(
    productIds: string[],
    context?: Context,
  ): Promise<{ productId: string; collection: ProductCollectionDTO }[]> {
    if (productIds.length === 0) return []
    return this.getClient(context)
      .select({ productId: this.table.productId, collection: productCollectionTable })
      .from(this.table)
      .innerJoin(productCollectionTable, eq(productCollectionTable.id, this.table.collectionId))
      .where(
        and(
          inArray(this.table.productId, productIds),
          isNull(this.table.deletedAt),
          isNull(productCollectionTable.deletedAt),
        ),
      )
      .orderBy(asc(productCollectionTable.title), asc(productCollectionTable.id))
  }
}
