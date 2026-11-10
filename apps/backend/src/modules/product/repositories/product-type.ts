import { and, eq, inArray, isNull } from 'drizzle-orm'
import type { Context } from '../../../core/types/context.js'
import type { ProductTypeDTO } from '../../../core/types/product/common.js'
import { BaseRepository } from '../../../core/utils/base-repository.js'
import { productTable } from '../models/product.js'
import { productTypeTable } from '../models/product-type.js'

export class ProductTypeRepository extends BaseRepository(productTypeTable) {
  /**
   * The live Type of every product in `productIds` that has one, in one query. A soft-deleted Type
   * stays in `product.type_id` (`set null` fires only on a hard delete), so the join filters it out.
   */
  async findTypesOfProducts(
    productIds: string[],
    context?: Context,
  ): Promise<{ productId: string; type: ProductTypeDTO }[]> {
    if (productIds.length === 0) return []
    return this.getClient(context)
      .select({ productId: productTable.id, type: this.table })
      .from(productTable)
      .innerJoin(this.table, eq(this.table.id, productTable.typeId))
      .where(and(inArray(productTable.id, productIds), isNull(this.table.deletedAt)))
  }
}
