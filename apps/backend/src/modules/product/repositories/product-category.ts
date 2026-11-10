import { inArray, sql } from 'drizzle-orm'
import type { Context } from '../../../core/types/context.js'
import { BaseRepository } from '../../../core/utils/base-repository.js'
import { productCategoryTable } from '../models/product-category.js'

export class ProductCategoryRepository extends BaseRepository(productCategoryTable) {
  /** Writes `rank = position` for every id, in one statement. */
  async renumber(orderedIds: string[], context?: Context): Promise<void> {
    if (orderedIds.length === 0) return
    const ids = sql.join(
      orderedIds.map((id) => sql`${id}`),
      sql`, `,
    )
    await this.getClient(context)
      .update(this.table)
      .set({ rank: sql`array_position(ARRAY[${ids}]::text[], ${this.table.id}) - 1` })
      .where(inArray(this.table.id, orderedIds))
  }

  /** Whether `candidateId` is `categoryId` itself or one of its live descendants. */
  async isInSubtree(categoryId: string, candidateId: string, context?: Context): Promise<boolean> {
    const [row] = await this.getClient(context).execute<{ found: boolean }>(sql`
      WITH RECURSIVE subtree AS (
        SELECT id FROM product_category WHERE id = ${categoryId} AND deleted_at IS NULL
        UNION ALL
        SELECT child.id FROM product_category child
        JOIN subtree ON child.parent_id = subtree.id
        WHERE child.deleted_at IS NULL
      )
      SELECT EXISTS (SELECT 1 FROM subtree WHERE id = ${candidateId}) AS found
    `)
    return row?.found === true
  }
}
