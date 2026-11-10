import { and, eq, exists, inArray, isNull, type SQL, sql } from 'drizzle-orm'
import type { Context } from '../../../core/types/context.js'
import type { FilterableProductProps } from '../../../core/types/product/common.js'
import { BaseRepository } from '../../../core/utils/base-repository.js'
import { productTable } from '../models/product.js'
import { productCollectionTable } from '../models/product-collection.js'
import { productProductCategoryTable } from '../models/product-product-category.js'
import { productProductCollectionTable } from '../models/product-product-collection.js'
import { visibleCategoriesQuery } from './product-category.js'

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
    if (!filters) return undefined
    const { categoryId, categoryHandle, collectionId, includeDescendants = false, visibleOnly = false } = filters
    const clauses: SQL[] = []
    const scope = { includeDescendants, visibleOnly }
    if (categoryId !== undefined) clauses.push(this.inCategories(sql`id`, asArray(categoryId), scope))
    if (categoryHandle !== undefined) clauses.push(this.inCategories(sql`handle`, asArray(categoryHandle), scope))
    if (collectionId !== undefined) clauses.push(this.inCollections(asArray(collectionId)))
    return clauses.length > 0 ? and(...clauses) : undefined
  }

  /**
   * Members of the Categories whose `column` is one of `values`. Direct members only by default — a
   * product in a child Category is not in its parent — and widened to the matched Categories'
   * subtrees by `includeDescendants`. `visibleOnly` walks the Visible tree instead of every live
   * Category, so a hidden Category, or one under a hidden ancestor, matches nothing.
   */
  private inCategories(
    column: SQL,
    values: string[],
    { includeDescendants, visibleOnly }: { includeDescendants: boolean; visibleOnly: boolean },
  ): SQL {
    const pool = visibleOnly
      ? sql`visible_category AS (${visibleCategoriesQuery}), category_pool AS (SELECT * FROM visible_category)`
      : sql`category_pool AS (SELECT id, parent_id, handle FROM product_category WHERE deleted_at IS NULL)`
    const descendants = includeDescendants
      ? sql`UNION ALL SELECT child.id FROM category_pool child JOIN matched_category parent ON child.parent_id = parent.id`
      : sql``
    const matchedValues = sql.join(
      values.map((value) => sql`${value}`),
      sql`, `,
    )
    return sql`EXISTS (
      WITH RECURSIVE ${pool},
      matched_category AS (
        SELECT id FROM category_pool WHERE ${column} IN (${matchedValues})
        ${descendants}
      )
      SELECT 1 FROM ${productProductCategoryTable}
      WHERE ${productProductCategoryTable.productId} = ${this.table.id}
        AND ${productProductCategoryTable.deletedAt} IS NULL
        AND ${productProductCategoryTable.categoryId} IN (SELECT id FROM matched_category)
    )`
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
