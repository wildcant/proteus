import { i18n } from '@proteus/utils'
import { and, eq, isNull } from 'drizzle-orm'
import { AppError, ErrorTypes } from '../../../core/errors/app-error.js'
import type { Context } from '../../../core/types/context.js'
import { BaseRepository } from '../../../core/utils/base-repository.js'
import { paymentCollectionTable } from '../models/payment-collection.js'

export class PaymentCollectionRepository extends BaseRepository(paymentCollectionTable) {
  /**
   * Takes the collection's row lock (`SELECT … FOR UPDATE`) for the rest of the caller's
   * transaction.
   *
   * Every write that moves money against a collection takes it first, so two admins recording a
   * payment at once are serialized: the second reads the captures the first committed and is
   * refused when the two together would exceed the authorization. Outside a transaction the lock
   * is released the moment the statement ends, so a caller that passes none has locked nothing —
   * which is why this refuses rather than quietly reading the row.
   */
  async lockForUpdate(id: string, context: Context) {
    if (!context.transaction) {
      throw new AppError({
        type: ErrorTypes.UNEXPECTED_STATE,
        message: i18n.t('Locking payment collection "{id}" needs a transaction.'),
        values: { id },
      })
    }

    const [row] = await this.getClient(context)
      .select()
      .from(this.table)
      .where(and(eq(this.table.id, id), isNull(this.table.deletedAt)))
      .for('update')

    if (!row) {
      throw new AppError({
        type: ErrorTypes.NOT_FOUND,
        message: i18n.t('Entity with id "{id}" not found'),
        values: { id },
      })
    }
    return row
  }
}
