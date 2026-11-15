import type { BigNumber } from '@core/bignumber.js'
import { createWorkflow } from '@core/workflows/types.js'
import {
  type CapturedOrderPayment,
  recordOrderPaymentStep,
  recordOrderPaymentThrows,
} from './steps/record-order-payment.js'

type RecordOrderPaymentInput = { orderId: string; amount: BigNumber }

/**
 * Records a payment received outside Proteus — a bank transfer, cash on delivery — on an Order,
 * Medusa's way: a capture of part of the Order's single payment collection, written as one Order
 * transaction, so Paid Total, Outstanding Amount and payment status follow what was received.
 *
 * Idempotent: every step either refuses, converges on a capture already recorded under the key the
 * first step minted, or converges on the transaction already recorded for that capture. A retried
 * step therefore never captures twice or doubles the Paid Total.
 */
export const recordOrderPaymentWorkflow = createWorkflow<RecordOrderPaymentInput, CapturedOrderPayment>(
  { name: 'record-order-payment', idempotent: true, throws: [...recordOrderPaymentThrows] },
  async (ctx, input) => {
    return recordOrderPaymentStep(ctx, input)
  },
)
