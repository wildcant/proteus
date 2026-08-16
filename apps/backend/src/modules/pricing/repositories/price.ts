import { and, eq, inArray, isNull } from 'drizzle-orm'
import type { Context } from '../../../core/types/context.js'
import { BaseRepository } from '../../../core/utils/base-repository.js'
import { priceTable } from '../models/price.js'

export class PriceRepository extends BaseRepository(priceTable) {
  async findByPriceSetIds(priceSetIds: string[], currencyCode: string, context?: Context) {
    const client = this.getClient(context)
    return client
      .select()
      .from(this.table)
      .where(
        and(
          inArray(this.table.priceSetId, priceSetIds),
          eq(this.table.currencyCode, currencyCode),
          isNull(this.table.deletedAt),
        ),
      )
  }
}
