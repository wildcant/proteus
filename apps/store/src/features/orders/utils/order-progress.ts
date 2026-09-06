import type { StoreOrderFulfillmentStatus, StoreOrderResponseOrder } from '#/api/generated/model'
import { fulfillmentLabels } from './fulfillment-labels'

/**
 * The fulfillment states in the order they happen. The generated union is a set of strings with
 * no inherent sequence, so the sequence is stated once here rather than re-derived at each call
 * site that wants to know what comes next.
 */
export const fulfillmentSequence = [
  'unfulfilled',
  'fulfilled',
  'shipped',
  'delivered',
] as const satisfies readonly StoreOrderFulfillmentStatus[]

export type ProgressStep = {
  label: string
  /** `current` is the furthest step reached, not the next one pending. */
  state: 'done' | 'current' | 'upcoming'
}

/**
 * A terminal state that ends the sequence — nothing further will happen, so rendering the
 * remaining steps would be promising a delivery that is not coming.
 */
type StoppedProgress = { kind: 'stopped'; label: string; detail: string }

type RunningProgress = { kind: 'inProgress'; label: string; steps: ProgressStep[] }

export type OrderProgress = StoppedProgress | RunningProgress

/**
 * What the shopper is told about where their order is.
 *
 * Reads `status` as well as `fulfillmentStatus`, which the page previously ignored entirely: a
 * canceled order keeps whatever fulfillment status it held when it was canceled, so rendering
 * that alone told someone whose order was called off that it was still being prepared.
 *
 * `archived` is deliberately not terminal here. It is a merchant's filing action on a finished
 * order, and it says nothing to the person who bought it.
 */
export function orderProgress(order: StoreOrderResponseOrder): OrderProgress {
  if (order.status === 'canceled') {
    return {
      kind: 'stopped',
      label: 'Canceled',
      // Deliberately says nothing about the money: what happens to an authorization on
      // cancellation is the payment provider's behaviour, and the panel below is where the
      // response actually has something to say about it.
      detail: 'This order was canceled and will not be fulfilled.',
    }
  }

  const reached = fulfillmentSequence.indexOf(order.fulfillmentStatus)

  return {
    kind: 'inProgress',
    label: fulfillmentLabels[order.fulfillmentStatus],
    steps: fulfillmentSequence.map((status, index) => ({
      label: fulfillmentLabels[status],
      state: index < reached ? 'done' : index === reached ? 'current' : 'upcoming',
    })),
  }
}
