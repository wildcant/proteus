import type { StoreCartDetailResponse, StoreCompleteCartResponse } from '@proteus/http-schemas/store'
import type { ApiErrorBody, TestApi } from '@tests/setup/create-api.js'
import { test } from '@tests/setup/test-extend.js'
import { assertDefined } from '@tests/utils/assert-defined.js'
import { vi } from 'vitest'
import cartDefinitions from '../definitions.js'

/** A completion either returns the order or the error body saying why it lost the race, and
 *  only the status says which — so both shapes are in play for every response in the batch. */
type CompletionBody = StoreCompleteCartResponse | ApiErrorBody

const CONCURRENT_REQUESTS = 5

/**
 * Which step the loser dies at depends on timing, so all three outcomes are legitimate:
 * `duplicate_error` when it reaches `link-order` and hits the unique index on
 * `order_cart.cart_id`, `not_allowed` when it gets as far as `check-cart-not-completed`
 * after the winner has already stamped `completedAt`, and `conflict` when it re-enters
 * `check-idempotency` in between the two.
 */
const RACE_REJECTION_TYPES = ['duplicate_error', 'not_allowed', 'conflict']

let api: TestApi

test.beforeEach(async ({ createApi }) => {
  api = await createApi({ definitions: cartDefinitions })
})

const completeCartConcurrently = (cartId: string) =>
  Promise.all(
    Array.from({ length: CONCURRENT_REQUESTS }, () => api.post<CompletionBody>(`/store/carts/${cartId}/complete`)),
  )

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

    const returnedOrderIds = new Set<string>()
    const rejectedTypes: string[] = []
    for (const { body } of responses) {
      if ('orderId' in body) returnedOrderIds.add(body.orderId)
      else rejectedTypes.push(body.type)
    }

    // Whoever got an order back got the same one.
    expect(returnedOrderIds).toEqual(new Set([orderId]))

    // The rest were rejected. A 422 beats a 500, but it is still the wrong answer for a shopper
    // who double-clicked: their order exists and they were told it failed. Serializing the
    // request would let the loser fall through to `check-idempotency` and return a 200.
    expect(rejectedTypes.length).toBeGreaterThan(0)
    expect(rejectedTypes.filter((type) => !RACE_REJECTION_TYPES.includes(type))).toEqual([])
  })

  /**
   * The window the concurrent test cannot pin down, reconstructed directly: the winner has
   * written the order↔cart link but has not reached `mark-cart-completed`. Locally that gap is
   * a couple of milliseconds; with the database a network hop away it is hundreds, and every
   * click landing in it used to get a 500 announcing a partial failure that had not happened.
   */
  test('reports a completion still in flight as a conflict, not a server error', async ({ service, expect }) => {
    const { cart, order } = await service.create.order(api.container)

    // Same state a losing request observes mid-race, minus the race. `customerId` is carried
    // over because the generator would otherwise invent one, and `validateCartOwnership`
    // rejects the request before the workflow this test is about ever runs.
    await service.update.cart(api.container, cart.id, { completedAt: null, customerId: cart.customerId })

    const { status, body } = await api.post<ApiErrorBody>(`/store/carts/${cart.id}/complete`)

    expect(status).toBe(409)
    expect(body.type).toBe('conflict')

    // The guard has to reject rather than hand back `order`: at this point in the winner's run
    // payment is not authorized yet and the whole thing can still compensate away.
    expect(await service.read.orders(api.container)).toHaveLength(1)
    expect(await service.read.order(api.container, order.id)).toMatchObject({ id: order.id })
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

    const response = await api.post<CompletionBody>(`/store/carts/${cartId}/complete`)

    expect(response.status).not.toBe(200)
    expect(await service.read.orders(api.container)).toHaveLength(0)
    expect(await service.read.linkRepo(api.container, 'orderCart').findByCartId(cartId)).toBeNull()
  })
})

/**
 * The cart's addresses are rows the cart owns, keyed by `type`, rather than two columns pointing
 * outward. This is the seam where that shape reaches a client, so it is asserted here.
 */
test.describe('GET /store/carts/:id', () => {
  test('returns the cart’s shipping and billing addresses', async ({ dto, service, expect }) => {
    const { cart } = await service.create.checkoutReadyCart(api.container)
    await service.create.cartAddresses(api.container, cart.id, {
      shippingAddress: dto.generate.createCartAddress({ firstName: 'John', city: 'Springfield' }),
      billingAddress: dto.generate.createCartAddress({ firstName: 'Jane', city: 'Shelbyville' }),
    })

    const { status, body } = await api.get<StoreCartDetailResponse>(`/store/carts/${cart.id}`)

    expect(status).toBe(200)
    expect(body.cart.shippingAddress).toMatchObject({
      cartId: cart.id,
      type: 'shipping',
      firstName: 'John',
      city: 'Springfield',
    })
    expect(body.cart.billingAddress).toMatchObject({
      cartId: cart.id,
      type: 'billing',
      firstName: 'Jane',
      city: 'Shelbyville',
    })
  })

  test('returns null for a type the cart has not filled', async ({ dto, service, expect }) => {
    const { cart } = await service.create.checkoutReadyCart(api.container)
    await service.create.cartAddresses(api.container, cart.id, {
      shippingAddress: dto.generate.createCartAddress(),
      billingAddress: undefined,
    })

    const { body } = await api.get<StoreCartDetailResponse>(`/store/carts/${cart.id}`)

    expect(body.cart.shippingAddress).toMatchObject({ type: 'shipping' })
    expect(body.cart.billingAddress).toBeNull()
  })
})
