import { and, eq, exists, inArray, isNull, type SQL } from 'drizzle-orm'
import type { Context } from '../../../core/types/context.js'
import type { FilterableProductProps } from '../../../core/types/product/common.js'
import { BaseRepository } from '../../../core/utils/base-repository.js'
import { productTable } from '../models/product.js'
import { productCategoryTable } from '../models/product-category.js'
import { productCollectionTable } from '../models/product-collection.js'
import { productProductCategoryTable } from '../models/product-product-category.js'
import { productProductCollectionTable } from '../models/product-product-collection.js'

const asArray = (value: string | string[]) => (Array.isArray(value) ? value : [value])

export class ProductRepository extends BaseRepository(productTable) {
  async findByHandle(handle: string, context?: Context) {
    const client = this.getClient(context)
    const rows = await client
      .select()
      .from(this.table)
      .where(and(eq(this.table.handle, handle), isNull(this.table.deletedAt)))
    return rows[0] ?? null
  }

  /** The grouping filters: each one an `EXISTS`, ANDed with the column filters and each other. */
  protected override extraWhere(filters?: FilterableProductProps): SQL | undefined {
    const clauses: SQL[] = []
    if (filters?.categoryId !== undefined) clauses.push(this.inCategories(asArray(filters.categoryId)))
    if (filters?.collectionId !== undefined) clauses.push(this.inCollections(asArray(filters.collectionId)))
    return clauses.length > 0 ? and(...clauses) : undefined
  }

  /** Direct members only: a product in a child Category is not in its parent. */
  private inCategories(categoryIds: string[]): SQL {
    const client = this.getClient()
    return exists(
      client
        .select({ id: productProductCategoryTable.id })
        .from(productProductCategoryTable)
        .innerJoin(productCategoryTable, eq(productCategoryTable.id, productProductCategoryTable.categoryId))
        .where(
          and(
            eq(productProductCategoryTable.productId, this.table.id),
            inArray(productProductCategoryTable.categoryId, categoryIds),
            isNull(productProductCategoryTable.deletedAt),
            isNull(productCategoryTable.deletedAt),
          ),
        ),
    )
  }

  private inCollections(collectionIds: string[]): SQL {
    const client = this.getClient()
    return exists(
      client
        .select({ id: productProductCollectionTable.id })
        .from(productProductCollectionTable)
        .innerJoin(productCollectionTable, eq(productCollectionTable.id, productProductCollectionTable.collectionId))
        .where(
          and(
            eq(productProductCollectionTable.productId, this.table.id),
            inArray(productProductCollectionTable.collectionId, collectionIds),
            isNull(productProductCollectionTable.deletedAt),
            isNull(productCollectionTable.deletedAt),
          ),
        ),
    )
  }
}
