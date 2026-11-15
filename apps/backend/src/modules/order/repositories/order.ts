import { and, eq, isNull, sql } from 'drizzle-orm'
import type { Context } from '../../../core/types/context.js'
import { BaseRepository } from '../../../core/utils/base-repository.js'
import { orderAddressTable } from '../models/address.js'
import { orderTable } from '../models/order.js'

export class OrderRepository extends BaseRepository(orderTable) {
  /**
   * The guest lookup's one query. The digits are matched in SQL against the shipping phone with
   * every non-digit stripped, so "+57 300 123-4567" ends in "4567". An inner join, so an Order with
   * no shipping address or no phone falls out exactly as a wrong number or wrong digits do.
   */
  async findIdByDisplayIdAndPhoneDigits(
    displayId: number,
    phoneLastDigits: string,
    context?: Context,
  ): Promise<string | null> {
    const client = this.getClient(context)
    const phoneDigits = sql`regexp_replace(${orderAddressTable.phone}, '[^0-9]', '', 'g')`

    const rows = await client
      .select({ id: this.table.id })
      .from(this.table)
      .innerJoin(
        orderAddressTable,
        and(
          eq(orderAddressTable.orderId, this.table.id),
          eq(orderAddressTable.type, 'shipping'),
          isNull(orderAddressTable.deletedAt),
        ),
      )
      .where(
        and(
          eq(this.table.displayId, displayId),
          isNull(this.table.deletedAt),
          sql`right(${phoneDigits}, char_length(${phoneLastDigits})) = ${phoneLastDigits}`,
        ),
      )
      .limit(1)

    return rows[0]?.id ?? null
  }
}
