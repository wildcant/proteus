import { BigNumber } from '@core/bignumber.js'
import { ErrorTypes } from '@core/errors/app-error.js'
import { ContainerRegistrationKeys } from '@core/utils/container.js'
import { Modules } from '@core/utils/modules-definition.js'
import { createWorkflow, WorkflowTerminalError } from '@core/workflows/types.js'
import { i18n } from '@proteus/utils'
import { addOrderTransactionsStep } from '../order/steps/add-order-transactions.js'
import { type PlannedRefund, refundPaymentsStep } from './steps/refund-payments.js'

type RefundPaymentInput = {
  paymentId: string
  /** Omitted, everything the payment has received and not yet returned. */
  amount?: BigNumber | undefined
  refundReasonId?: string | undefined
  note?: string | undefined
}

/**
 * Returns money a payment received and records it as one negative Order transaction, keyed by the
 * refund row, on the Order whose collection the payment belongs to (Medusa's
 * `refundPaymentWorkflow`). Refused above what the payment received less what it already returned.
 *
 * Each step is safe to run twice — the refund is recorded under a key minted by the first step, and
 * the transaction is keyed by the refund row — but, as with `capture-payment`, the workflow is not
 * declared `idempotent`, so a gateway failure reaches the admin rather than an engine retry.
 */
export const refundPaymentWorkflow = createWorkflow<RefundPaymentInput, { paymentId: string }>(
  {
    name: 'refund-payment',
    // NOT_ALLOWED is the payment module's, rethrown terminal by `asTerminalRefusal`
    // ast-grep-ignore: workflow-declares-unthrown-error
    throws: [ErrorTypes.INVALID_DATA, ErrorTypes.NOT_ALLOWED],
  },
  async (ctx, input) => {
    const plan = await ctx.step('prepare-refund', async ({ container }) => {
      const paymentService = container.resolve(Modules.PAYMENT)
      const linkService = container.resolve(ContainerRegistrationKeys.LINK)

      const payment = await paymentService.retrievePayment(input.paymentId)
      const captured = (payment.captures ?? []).reduce((sum, row) => sum.plus(row.amount), new BigNumber(0))
      const refunded = (payment.refunds ?? []).reduce((sum, row) => sum.plus(row.amount), new BigNumber(0))
      const received = captured.minus(refunded)
      const amount = input.amount ?? received

      if (!amount.isGreaterThan(0) || amount.isGreaterThan(received)) {
        throw new WorkflowTerminalError({
          type: ErrorTypes.INVALID_DATA,
          message: i18n.t('Refund amount {amount} must be more than zero and at most the {received} received.'),
          values: { amount: amount.toFixed(), received: received.toFixed() },
        })
      }

      const link = await linkService
        .repo('orderPaymentCollection')
        .findByPaymentCollectionId(payment.paymentCollectionId)
      const refunds: PlannedRefund[] = [
        {
          paymentId: payment.id,
          amount,
          refundReasonId: input.refundReasonId,
          note: input.note,
          idempotencyKey: crypto.randomUUID(),
        },
      ]

      return { refunds, orderId: link?.orderId ?? null }
    })

    const refunded = await refundPaymentsStep(ctx, plan)
    await addOrderTransactionsStep(ctx, refunded)

    return { paymentId: input.paymentId }
  },
)
