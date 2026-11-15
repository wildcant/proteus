import type { BigNumber } from '@core/bignumber.js'
import { AppError, ErrorTypes } from '@core/errors/app-error.js'
import type { CreateOrderTransactionDTO } from '@core/types/order/mutations.js'
import { ContainerRegistrationKeys } from '@core/utils/container.js'
import { Modules } from '@core/utils/modules-definition.js'
import { createWorkflow } from '@core/workflows/types.js'
import { i18n } from '@proteus/utils'
import { addOrderTransactionsStep } from '../order/steps/add-order-transactions.js'
import { asTerminalRefusal } from './utils/as-terminal-refusal.js'

type CapturePaymentInput = {
  paymentId: string
  /** Omitted, the capture takes everything the authorization still holds. */
  amount?: BigNumber | undefined
}

type CapturePaymentOutput = { paymentId: string; captureId: string }

/**
 * Captures one payment — a manual-capture card authorization, or part of a manual one — and
 * records it as an Order transaction on the Order whose collection it belongs to (Medusa's
 * `capturePaymentWorkflow`). A payment no Order holds yet records none.
 *
 * Each step is safe to run twice — the key minted first names the capture, and the transaction is
 * keyed by the capture row — but the workflow is not declared `idempotent`: the payment is usually
 * a card's, and whether a gateway failure is retried is the admin's call, not the engine's.
 */
export const capturePaymentWorkflow = createWorkflow<CapturePaymentInput, CapturePaymentOutput>(
  {
    name: 'capture-payment',
    // the refusals are the payment module's, rethrown terminal by `asTerminalRefusal`
    // ast-grep-ignore: workflow-declares-unthrown-error
    throws: [ErrorTypes.INVALID_DATA, ErrorTypes.NOT_ALLOWED],
  },
  async (ctx, input) => {
    const prepared = await ctx.step('prepare-capture', async ({ container }) => {
      const paymentService = container.resolve(Modules.PAYMENT)
      const linkService = container.resolve(ContainerRegistrationKeys.LINK)

      const payment = await paymentService.retrievePayment(input.paymentId)
      const link = await linkService
        .repo('orderPaymentCollection')
        .findByPaymentCollectionId(payment.paymentCollectionId)

      return { orderId: link?.orderId ?? null, idempotencyKey: crypto.randomUUID() }
    })

    const captured = await ctx.step('capture-payment', async ({ container }) => {
      const paymentService = container.resolve(Modules.PAYMENT)

      const payment = await paymentService
        .capturePayment({ paymentId: input.paymentId, amount: input.amount, idempotencyKey: prepared.idempotencyKey })
        .catch(asTerminalRefusal)

      const capture = payment.captures?.find((row) => row.idempotencyKey === prepared.idempotencyKey)
      if (!capture) {
        throw new AppError({
          type: ErrorTypes.UNEXPECTED_STATE,
          message: i18n.t('Payment "{id}" holds no capture recorded under this request.'),
          values: { id: payment.id },
        })
      }

      const transactions: CreateOrderTransactionDTO[] = prepared.orderId
        ? [
            {
              orderId: prepared.orderId,
              amount: capture.amount,
              currencyCode: payment.currencyCode,
              reference: 'capture',
              referenceId: capture.id,
            },
          ]
        : []

      return { paymentId: payment.id, captureId: capture.id, transactions }
    })

    await addOrderTransactionsStep(ctx, { transactions: captured.transactions })

    return { paymentId: captured.paymentId, captureId: captured.captureId }
  },
)
