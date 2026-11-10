import { and, asc, eq, inArray, isNull } from 'drizzle-orm'
import type { Context } from '../../../core/types/context.js'
import type { ProductCategoryDTO } from '../../../core/types/product/common.js'
import { BaseRepository } from '../../../core/utils/base-repository.js'
import { productCategoryTable } from '../models/product-category.js'
import { productProductCategoryTable } from '../models/product-product-category.js'

export class ProductProductCategoryRepository extends BaseRepository(productProductCategoryTable) {
  /**
   * The live Categories of every product in `productIds`, in one query. Both the pivot row and the
   * Category must be live: a write checks the foreign key only, so a pivot can name a Category that
   * was soft-deleted since.
   */
  async findCategoriesOfProducts(
    productIds: string[],
    context?: Context,
  ): Promise<{ productId: string; category: ProductCategoryDTO }[]> {
    if (productIds.length === 0) return []
    return this.getClient(context)
      .select({ productId: this.table.productId, category: productCategoryTable })
      .from(this.table)
      .innerJoin(productCategoryTable, eq(productCategoryTable.id, this.table.categoryId))
      .where(
        and(
          inArray(this.table.productId, productIds),
          isNull(this.table.deletedAt),
          isNull(productCategoryTable.deletedAt),
        ),
      )
      .orderBy(asc(productCategoryTable.name), asc(productCategoryTable.id))
  }
}
