import { and, eq, isNull } from 'drizzle-orm'
import type { Context } from '../../core/types/context.js'
import { BaseRepository } from '../../core/utils/base-repository.js'
import { cartPaymentCollectionTable } from '../definitions/cart-payment-collection.js'

export class CartPaymentCollectionRepository extends BaseRepository(cartPaymentCollectionTable) {
  async findByCartId(cartId: string, context?: Context) {
    const client = this.getClient(context)
    const rows = await client
      .select()
      .from(this.table)
      .where(and(eq(this.table.cartId, cartId), isNull(this.table.deletedAt)))
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
