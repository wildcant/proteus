import type { TestApi } from '@tests/setup/create-api.js'
import { test } from '@tests/setup/test-extend.js'
import { assertDefined } from '@tests/utils/assert-defined.js'
import { vi } from 'vitest'
import cartDefinitions from '../definitions.js'

const CONCURRENT_REQUESTS = 5

/**
 * Which step the loser dies at depends on timing, so both outcomes are legitimate:
 * `duplicate_error` when it reaches `link-order` and hits the unique index on
 * `order_cart.cart_id`, `not_allowed` when it gets as far as `check-cart-not-completed`
 * after the winner has already stamped `completedAt`.
 */
const RACE_REJECTION_TYPES = ['duplicate_error', 'not_allowed']

let api: TestApi

test.beforeEach(async ({ createApi }) => {
  api = await createApi({ definitions: cartDefinitions })
})

const completeCartConcurrently = (cartId: string) =>
  Promise.all(Array.from({ length: CONCURRENT_REQUESTS }, () => api.post(`/store/carts/${cartId}/complete`)))

/**
 * Concurrent completions of one cart. Nothing in the workflow serializes them —
 * `check-idempotency` and `check-cart-not-completed` are read-then-act windows that every
 * request passes before any of them writes. What holds the line is the unique index on
 * `order_cart.cart_id`: the loser fails at `link-order` and compensation unwinds its order,
 * so payment authorization and inventory reservation are never reached.
 */
test.describe('POST /store/carts/:id/complete (concurrent)', () => {
  test('completes the cart exactly once', async ({ service, expect }) => {
    // Quantity is pinned because the reservation assertion below counts units: the fixture's
    // default stock is one, so anything above one ordered unit stops being an oversell signal.
    const { cart, paymentCollection } = await service.create.checkoutReadyCart(api.container, {
      lineItem: { quantity: 1 },
    })
    assertDefined(paymentCollection)
    const cartId = cart.id
    const paymentCollectionId = paymentCollection.id
    const responses = await completeCartConcurrently(cartId)

    const orders = await service.read.orders(api.container)
    expect(orders).toHaveLength(1)
    const orderId = orders[0]?.id

    // Both links resolve to the winner. `link-order` writes them in one transaction, so a
    // loser rejected on `order_cart.cart_id` cannot leave its payment-collection link behind
    // for `create-order`'s compensation to orphan.
    expect(await service.read.linkRepo(api.container, 'orderCart').findByCartId(cartId)).toMatchObject({ orderId })
    expect(
      await service.read
        .linkRepo(api.container, 'orderPaymentCollection')
        .findByPaymentCollectionId(paymentCollectionId),
    ).toMatchObject({ orderId })

    // `authorizePaymentSession` guards on a SELECT, so it is only safe because the losers never
    // reach it — `link-order` fails first. Against a real PSP each extra call here would be a
    // separate authorization on the shopper's card.
    const collection = await service.read.paymentCollection(api.container, paymentCollectionId)
    expect(collection.paymentSessions ?? []).toHaveLength(1)
    expect(collection.payments ?? []).toHaveLength(1)

    // Exactly one unit is stocked, so a second reservation would be an oversell.
    const reservations = await service.read.reservationItems(api.container)
    expect(reservations.reduce((sum, reservation) => sum + reservation.quantity, 0)).toBe(1)

    // Whoever got an order back got the same one.
    const returnedOrderIds = responses
      .filter((response) => response.status === 200)
      .map((response) => (response.body as { orderId: string }).orderId)
    expect(new Set(returnedOrderIds)).toEqual(new Set([orderId]))

    // The rest were rejected. A 422 beats a 500, but it is still the wrong answer for a shopper
    // who double-clicked: their order exists and they were told it failed. Serializing the
    // request would let the loser fall through to `check-idempotency` and return a 200.
    const rejectedTypes = responses
      .filter((response) => response.status !== 200)
      .map((response) => (response.body as { type: string }).type)
    expect(rejectedTypes.length).toBeGreaterThan(0)
    expect(rejectedTypes.filter((type) => !RACE_REJECTION_TYPES.includes(type))).toEqual([])
  })

  test('rolls back an earlier link when a later one fails', async ({ service, expect }) => {
    const { cart } = await service.create.checkoutReadyCart(api.container)
    const cartId = cart.id

    // The mirror of the concurrent case, and the one ordering alone does not cover: the
    // order↔cart link succeeds and the payment-collection link fails. Without a shared
    // transaction the first row commits, the step throws so its compensation is never
    // registered, and `create-order`'s compensation hard-deletes the order underneath it.
    vi.spyOn(service.read.linkRepo(api.container, 'orderPaymentCollection'), 'create').mockRejectedValueOnce(
      new Error('payment collection link unavailable'),
    )

    const response = await api.post(`/store/carts/${cartId}/complete`)

    expect(response.status).not.toBe(200)
    expect(await service.read.orders(api.container)).toHaveLength(0)
    expect(await service.read.linkRepo(api.container, 'orderCart').findByCartId(cartId)).toBeNull()
  })
})
