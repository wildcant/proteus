import { and, eq, isNull, lt, sql } from 'drizzle-orm'
import type { Context } from '../../../core/types/context.js'
import type { ProductImportDTO, ProductImportOutcomeDTO } from '../../../core/types/product/common.js'
import { BaseRepository } from '../../../core/utils/base-repository.js'
import { productImportTable } from '../models/product-import.js'

export class ProductImportRepository extends BaseRepository(productImportTable) {
  /**
   * Adds one product's outcome to the counters in a single statement, so two deliveries recording
   * at once cannot lose an increment between a read and a write.
   */
  async recordOutcome(id: string, result: ProductImportOutcomeDTO, context?: Context): Promise<void> {
    const column = this.table[result.outcome]
    const errors =
      result.outcome === 'failed'
        ? sql`${this.table.errors} || ${JSON.stringify([result.error])}::jsonb`
        : sql`${this.table.errors}`
    await this.getClient(context)
      .update(this.table)
      .set({ [result.outcome]: sql`${column} + 1`, errors, updatedAt: sql`now()` })
      .where(eq(this.table.id, id))
  }

  /** Marks every live job still `previewed` from before `before` as `expired`, and returns them. */
  async expirePreviewedBefore(before: Date, context?: Context): Promise<ProductImportDTO[]> {
    return this.getClient(context)
      .update(this.table)
      .set({ status: 'expired', updatedAt: sql`now()` })
      .where(and(eq(this.table.status, 'previewed'), lt(this.table.createdAt, before), isNull(this.table.deletedAt)))
      .returning()
  }
}
