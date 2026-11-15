import type { BigNumber } from '@core/bignumber.js'
import { AppError, ErrorTypes } from '@core/errors/app-error.js'
import type { CreateOrderTransactionDTO } from '@core/types/order/mutations.js'
import { Modules } from '@core/utils/modules-definition.js'
import { type WorkflowContext, WorkflowTerminalError } from '@core/workflows/types.js'
import { i18n } from '@proteus/utils'
import { addOrderTransactionsStep } from '../../order/steps/add-order-transactions.js'
import { createOrderPaymentCollectionStep } from '../../order/steps/create-order-payment-collection.js'
import { asTerminalRefusal } from '../utils/as-terminal-refusal.js'

/** A step in its own file still owns its failure contract; the workflow calling it spreads this. */
export const recordOrderPaymentThrows = [ErrorTypes.INVALID_DATA, ErrorTypes.NOT_ALLOWED] as const

type RecordOrderPaymentInput = {
  orderId: string
  /**
   * What was received. Omitted records nothing and only gives the Order its collection — converting
   * a draft without a payment — so a workflow that may or may not record one still runs the same
   * steps every time.
   */
  amount?: BigNumber | null | undefined
}

type PreparedOrderPayment = {
  orderId: string
  /** Null when nothing is recorded. */
  amount: BigNumber | null
  /**
   * Minted here, one step before the capture, so it is recorded before any money moves: a capture
   * step that runs again after it committed presents the same key and is answered with the capture
   * it already made, instead of taking the deposit twice.
   */
  idempotencyKey: string
}

export type CapturedOrderPayment = {
  paymentCollectionId: string
  /** Null, with the capture's, when no amount was recorded. */
  paymentId: string | null
  captureId: string | null
  /** The one Order transaction this capture is recorded as, keyed by the capture row. */
  transactions: CreateOrderTransactionDTO[]
}

/**
 * Refuses a payment the Order cannot take, and mints the key the capture is recorded under.
 *
 * The amount is checked against the Order's Outstanding Amount here so the admin is told before
 * anything is written. It is not the check that keeps two admins from over-capturing: two of these
 * can pass at once, which is why the payment module checks again under the collection's row lock.
 */
async function prepareOrderPaymentStep(
  ctx: WorkflowContext,
  input: RecordOrderPaymentInput,
): Promise<PreparedOrderPayment> {
  return ctx.step<PreparedOrderPayment>('prepare-order-payment', async ({ container }) => {
    const orderService = container.resolve(Modules.ORDER)

    if (input.amount && !input.amount.isGreaterThan(0)) {
      throw new WorkflowTerminalError({
        type: ErrorTypes.INVALID_DATA,
        message: i18n.t('Payment amount must be greater than zero.'),
      })
    }

    const order = await orderService.retrieveOrder(input.orderId)
    if (order.status === 'canceled') {
      throw new WorkflowTerminalError({
        type: ErrorTypes.NOT_ALLOWED,
        message: i18n.t('Cannot record a payment on order {orderId}: it is canceled.'),
        values: { orderId: order.id },
      })
    }
    /** A Draft Order holds no payment collection: the shop records the deposit by converting it. */
    if (order.status === 'draft') {
      throw new WorkflowTerminalError({
        type: ErrorTypes.NOT_ALLOWED,
        message: i18n.t(
          'Cannot record a payment on order {orderId}: it is a draft — convert it to record its deposit.',
        ),
        values: { orderId: order.id },
      })
    }
    if (!input.amount) return { orderId: order.id, amount: null, idempotencyKey: '' }

    const [lineItems, shippingMethods, transactions] = await Promise.all([
      orderService.listOrderLineItems({ orderId: order.id }),
      orderService.listOrderShippingMethods({ orderId: order.id }),
      orderService.listOrderTransactions({ orderId: order.id }),
    ])
    const { outstandingTotal } = orderService.computeOrderTotals({ lineItems, shippingMethods, transactions })

    if (input.amount.isGreaterThan(outstandingTotal)) {
      throw new WorkflowTerminalError({
        type: ErrorTypes.INVALID_DATA,
        message: i18n.t('Payment amount {amount} exceeds the {outstanding} outstanding on order {orderId}.'),
        values: { amount: input.amount.toFixed(), outstanding: outstandingTotal.toFixed(), orderId: order.id },
      })
    }

    return {
      orderId: order.id,
      amount: input.amount,
      idempotencyKey: crypto.randomUUID(),
    }
  })
}

/**
 * Captures the amount against the Order's collection: the first payment recorded opens and
 * authorizes a manual session for everything outstanding, every one captures part of it. See
 * `capturePaymentCollection`, which takes the collection's row lock for the whole of it.
 *
 * The compensation returns the money, for a workflow that records a payment and then fails a later
 * step (a draft converted with its deposit, whose stock turned out to be gone). It is a refund
 * rather than an erasure because a real provider may already have moved it.
 */
async function captureOrderPaymentStep(
  ctx: WorkflowContext,
  input: PreparedOrderPayment,
  collection: { paymentCollectionId: string },
): Promise<CapturedOrderPayment> {
  return ctx.step<CapturedOrderPayment>(
    'capture-order-payment',
    async ({ container }) => {
      if (!input.amount) {
        return {
          paymentCollectionId: collection.paymentCollectionId,
          paymentId: null,
          captureId: null,
          transactions: [],
        }
      }
      const paymentService = container.resolve(Modules.PAYMENT)

      const payment = await paymentService
        .capturePaymentCollection(collection.paymentCollectionId, {
          amount: input.amount,
          idempotencyKey: input.idempotencyKey,
        })
        .catch(asTerminalRefusal)

      const capture = payment.captures?.find((row) => row.idempotencyKey === input.idempotencyKey)
      if (!capture) {
        throw new AppError({
          type: ErrorTypes.UNEXPECTED_STATE,
          message: i18n.t('Payment "{id}" holds no capture recorded under this request.'),
          values: { id: payment.id },
        })
      }

      return {
        paymentCollectionId: collection.paymentCollectionId,
        paymentId: payment.id,
        captureId: capture.id,
        transactions: [
          {
            orderId: input.orderId,
            amount: capture.amount,
            currencyCode: payment.currencyCode,
            reference: 'capture',
            referenceId: capture.id,
          },
        ],
      }
    },
    async (captured, { container }) => {
      if (!captured.paymentId || !input.amount) return
      const paymentService = container.resolve(Modules.PAYMENT)
      await paymentService.refundPayment({
        paymentId: captured.paymentId,
        amount: input.amount,
        idempotencyKey: `${input.idempotencyKey}:compensation`,
      })
    },
  )
}

/**
 * Records a payment of `amount` on an Order: a capture of part of its payment collection, and the
 * one Order transaction that capture is recorded as. Four steps — refuse or mint a key, give the
 * Order its collection if it has none, capture, write the transaction — and each is safe to run
 * again, which is what lets `record-order-payment` be declared idempotent.
 *
 * An Order placed by a checkout already has its collection; one that has none (a converted draft)
 * gets it here, for its total, so recording the deposit is all converting with a payment needs.
 * Reusable inside a larger workflow; the caller spreads `recordOrderPaymentThrows`.
 */
export async function recordOrderPaymentStep(
  ctx: WorkflowContext,
  input: RecordOrderPaymentInput,
): Promise<CapturedOrderPayment> {
  const prepared = await prepareOrderPaymentStep(ctx, input)
  const collection = await createOrderPaymentCollectionStep(ctx, { orderId: input.orderId })
  const captured = await captureOrderPaymentStep(ctx, prepared, collection)
  await addOrderTransactionsStep(ctx, { transactions: captured.transactions })
  return captured
}
