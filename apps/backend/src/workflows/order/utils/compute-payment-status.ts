import { BigNumber } from '@core/bignumber.js'
import type { PaymentStatus } from '@core/types/order/common.js'
import type { PaymentCollectionDTO } from '@core/types/payment/common.js'

export type PaymentStatusCollection = Pick<
  PaymentCollectionDTO,
  'status' | 'amount' | 'capturedAmount' | 'refundedAmount'
>

/**
 * An Order's payment status, aggregated from its payment collections the way Medusa's
 * `getLastPaymentStatus` does, and independent of the Order's own status and fulfillment status.
 *
 * Each collection votes: a full capture counts 1 towards `captured` and a partial one ½, a full
 * refund 1 towards `refunded` and a partial one ½, and the collection's own status counts 1 towards
 * itself. The most advanced status with a vote wins, `requires_action` first; it is the full one
 * only when its votes equal the collections that were not canceled.
 *
 * Proteus has one collection per Order, so a deposit reads `partially_captured`, the rest makes it
 * `captured`, and a canceled Order that returned part of a deposit reads `partially_refunded`. An
 * Order with no collection — a draft — is `not_paid`.
 */
export function computePaymentStatus(collections: PaymentStatusCollection[]): PaymentStatus {
  const votes = tally(collections)
  const votesFor = (status: string) => votes.get(status) ?? 0
  const notCanceled = collections.length - votesFor('canceled')
  const fullOrPartial = (full: PaymentStatus, partial: PaymentStatus) =>
    votesFor(full) === notCanceled ? full : partial

  if (votesFor('requires_action') > 0) return 'requires_action'
  if (votesFor('refunded') > 0) return fullOrPartial('refunded', 'partially_refunded')
  if (votesFor('captured') > 0) return fullOrPartial('captured', 'partially_captured')
  if (votesFor('authorized') > 0) return fullOrPartial('authorized', 'partially_authorized')
  if (votesFor('canceled') > 0 && votesFor('canceled') === collections.length) return 'canceled'
  if (votesFor('awaiting') > 0) return 'awaiting'
  return 'not_paid'
}

function tally(collections: PaymentStatusCollection[]): Map<string, number> {
  const votes = new Map<string, number>()
  const vote = (status: string, weight: number) => votes.set(status, (votes.get(status) ?? 0) + weight)

  for (const collection of collections) {
    const captured = collection.capturedAmount ?? new BigNumber(0)
    const refunded = collection.refundedAmount ?? new BigNumber(0)

    if (captured.isGreaterThan(0)) vote('captured', captured.isEqualTo(collection.amount) ? 1 : 0.5)
    if (refunded.isGreaterThan(0)) vote('refunded', refunded.isEqualTo(collection.amount) ? 1 : 0.5)
    vote(collection.status, 1)
  }

  return votes
}
