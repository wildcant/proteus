import type { OrderTransactionDTO } from '@core/types/order/common.js'
import type { CreateOrderTransactionDTO } from '@core/types/order/mutations.js'
import { Modules } from '@core/utils/modules-definition.js'
import type { WorkflowContext } from '@core/workflows/types.js'

type AddOrderTransactionsInput = {
  /** Each keyed by the capture or refund row it records (`reference`, `referenceId`). */
  transactions: CreateOrderTransactionDTO[]
}

/**
 * Writes the Order transactions that record captures and refunds, which is what the Order's Paid
 * Total is summed from.
 *
 * Safe to run twice. The order module answers a transaction already recorded for the same capture
 * or refund with the existing row instead of a second one, so a step retried after it committed —
 * or a later run converging on the same capture — leaves one transaction per payment-module row.
 *
 * An empty list is the action's own early return rather than an `if` around the call, so the
 * recorded step sequence is the same on every run.
 */
export async function addOrderTransactionsStep(
  ctx: WorkflowContext,
  input: AddOrderTransactionsInput,
): Promise<OrderTransactionDTO[]> {
  return ctx.step<OrderTransactionDTO[]>(
    'add-order-transactions',
    async ({ container }) => {
      if (input.transactions.length === 0) return []
      const orderService = container.resolve(Modules.ORDER)
      return orderService.addOrderTransactions(input.transactions)
    },
    async (transactions, { container }) => {
      if (transactions.length === 0) return
      const orderService = container.resolve(Modules.ORDER)
      await orderService.softDeleteOrderTransactions(transactions.map((transaction) => transaction.id))
    },
  )
}
