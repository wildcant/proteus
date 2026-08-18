import { and, eq, isNull } from 'drizzle-orm'
import type { Context } from '../../core/types/context.js'
import { BaseRepository } from '../../core/utils/base-repository.js'
import { orderPaymentCollectionTable } from '../definitions/index.js'

export class OrderPaymentCollectionRepository extends BaseRepository(orderPaymentCollectionTable) {
  async findByOrderId(orderId: string, context?: Context) {
    const client = this.getClient(context)
    const rows = await client
      .select()
      .from(this.table)
      .where(and(eq(this.table.orderId, orderId), isNull(this.table.deletedAt)))
    return rows[0] ?? null
  }

  async findByPaymentCollectionId(paymentCollectionId: string, context?: Context) {
    const client = this.getClient(context)
    const rows = await client
      .select()
      .from(this.table)
      .where(and(eq(this.table.paymentCollectionId, paymentCollectionId), isNull(this.table.deletedAt)))
    return rows[0] ?? null
  }
}
