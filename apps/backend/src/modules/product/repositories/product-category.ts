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
}
