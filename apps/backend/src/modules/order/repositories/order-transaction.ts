import type { Context } from '../../../core/types/context.js'
import { BaseRepository } from '../../../core/utils/base-repository.js'
import { type CreateOrderTransaction, type OrderTransaction, orderTransactionTable } from '../models/transaction.js'

export class OrderTransactionRepository extends BaseRepository(orderTransactionTable) {
  /**
   * Inserts the rows whose `(reference, referenceId)` slot is free and skips the rest, answering
   * with the rows it inserted. `ON CONFLICT DO NOTHING` rather than a read-then-write, so two
   * writers of the same capture's transaction cannot both find the slot empty.
   */
  async createManyIgnoringDuplicates(data: CreateOrderTransaction[], context?: Context): Promise<OrderTransaction[]> {
    if (data.length === 0) return []
    return this.getClient(context).insert(this.table).values(data).onConflictDoNothing().returning()
  }
}
