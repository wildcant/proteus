import type { BigNumber } from '@core/bignumber.js'
import { AppError, ErrorTypes } from '@core/errors/app-error.js'
import type { CreateOrderTransactionDTO } from '@core/types/order/mutations.js'
import { Modules } from '@core/utils/modules-definition.js'
import type { WorkflowContext } from '@core/workflows/types.js'
import { i18n } from '@proteus/utils'
import { asTerminalRefusal } from '../utils/as-terminal-refusal.js'

export type PlannedRefund = {
  paymentId: string
  amount: BigNumber
  refundReasonId?: string | undefined
  note?: string | undefined
  /** Minted by the step that planned the refund, so a refund step run twice returns the money once. */
  idempotencyKey: string
}

type RefundPaymentsInput = {
  refunds: PlannedRefund[]
  /** The Order the refunds are recorded on. Null for a payment no Order holds, which records none. */
  orderId: string | null
}

type RefundPaymentsOutput = {
  /** One Order transaction per refund row, negative, keyed by the refund. */
  transactions: CreateOrderTransactionDTO[]
}

/**
 * Returns money already captured, one refund per planned entry, and hands back the Order
 * transactions that record them for `addOrderTransactionsStep` to write.
 *
 * No compensation: a refund is money sent back, and nothing a later step does can take it back
 * from the shopper. Workflows place this after every step that could still fail for reasons of
 * their own.
 */
export async function refundPaymentsStep(
  ctx: WorkflowContext,
  input: RefundPaymentsInput,
): Promise<RefundPaymentsOutput> {
  return ctx.step<RefundPaymentsOutput>('refund-payments', async ({ container }) => {
    const paymentService = container.resolve(Modules.PAYMENT)

    // Sequential: each refund takes the collection's row lock, so they would queue on it anyway.
    const transactions: CreateOrderTransactionDTO[] = []
    for (const planned of input.refunds) {
      const payment = await paymentService
        .refundPayment({
          paymentId: planned.paymentId,
          amount: planned.amount,
          refundReasonId: planned.refundReasonId,
          note: planned.note,
          idempotencyKey: planned.idempotencyKey,
        })
        .catch(asTerminalRefusal)

      const refund = payment.refunds?.find((row) => row.idempotencyKey === planned.idempotencyKey)
      if (!refund) {
        throw new AppError({
          type: ErrorTypes.UNEXPECTED_STATE,
          message: i18n.t('Payment "{id}" holds no refund recorded under this request.'),
          values: { id: payment.id },
        })
      }

      if (input.orderId) {
        transactions.push({
          orderId: input.orderId,
          amount: refund.amount.negated(),
          currencyCode: payment.currencyCode,
          reference: 'refund',
          referenceId: refund.id,
        })
      }
    }

    return { transactions }
  })
}
