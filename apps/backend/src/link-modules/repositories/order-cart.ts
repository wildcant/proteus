import { and, eq, isNull } from 'drizzle-orm'
import type { Context } from '../../core/types/context.js'
import { BaseRepository } from '../../core/utils/base-repository.js'
import { orderCartTable } from '../definitions/index.js'

export class OrderCartRepository extends BaseRepository(orderCartTable) {
  async findByCartId(cartId: string, context?: Context) {
    const client = this.getClient(context)
    const rows = await client
      .select()
      .from(this.table)
      .where(and(eq(this.table.cartId, cartId), isNull(this.table.deletedAt)))
    return rows[0] ?? null
  }

  async findByOrderId(orderId: string, context?: Context) {
    const client = this.getClient(context)
    const rows = await client
      .select()
      .from(this.table)
      .where(and(eq(this.table.orderId, orderId), isNull(this.table.deletedAt)))
    return rows[0] ?? null
  }
}
