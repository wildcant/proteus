import { createServer, type Server } from 'node:http'
import type { DbProvider } from '@core/db/ports.js'
import type { IInventoryModuleService } from '@core/types/inventory/service.js'
import type { ILinkService } from '@core/types/link/service.js'
import type { IOrderModuleService } from '@core/types/order/service.js'
import type { IPaymentModuleService } from '@core/types/payment/service.js'
import { ContainerRegistrationKeys, Modules } from '@core/utils/index.js'
import { applyMiddleware } from '@framework/http/apply-middleware.js'
import { test } from '@tests/setup/test-extend.js'
import { assertDefined } from '@tests/utils/assert-defined.js'
import type { AwilixContainer } from 'awilix'
import request from 'supertest'
import { vi } from 'vitest'
import { bootstrapContainer } from '../../../../container.js'
import { createExpressApp } from '../../../../framework/runtime/express/app.js'
import cartDefinitions from '../definitions.js'

const CONCURRENT_REQUESTS = 5

/**
 * Which step the loser dies at depends on timing, so both outcomes are legitimate:
 * `duplicate_error` when it reaches `link-order` and hits the unique index on
 * `order_cart.cart_id`, `not_allowed` when it gets as far as `check-cart-not-completed`
 * after the winner has already stamped `completedAt`.
 */
const RACE_REJECTION_TYPES = ['duplicate_error', 'not_allowed']

let server: Server
let container: AwilixContainer

test.beforeEach(async ({ getDb, logger }) => {
  const dbProvider: DbProvider = {
    getDb,
    withConnection: (fn) => fn(),
    shutdown: async () => {
      // noop
    },
  }
  container = await bootstrapContainer({ logger, dbProvider })

  const routes = cartDefinitions
    .filter((definition) => definition.matcher === '/store/carts/:id/complete')
    .map((definition) => ({
      method: definition.method,
      matcher: definition.matcher,
      handler: applyMiddleware(definition),
    }))

  // Started up front: letting supertest create an ephemeral server per call adds enough
  // startup jitter that the requests stop overlapping and the race stops reproducing.
  server = createServer(createExpressApp({ routes, container, logger, corsOrigins: [] }))
  await new Promise<void>((resolve) => {
    server.listen(0, resolve)
  })
})

test.afterEach(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()))
})

const completeCartConcurrently = (cartId: string) =>
  Promise.all(
    Array.from({ length: CONCURRENT_REQUESTS }, () =>
      request(server).post(`/store/carts/${cartId}/complete`).set('Content-Type', 'application/json').send(),
    ),
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
    const { cart, paymentCollection } = await service.create.checkoutReadyCart(container, { lineItem: { quantity: 1 } })
    assertDefined(paymentCollection)
    const cartId = cart.id
    const paymentCollectionId = paymentCollection.id
    const orderService = container.resolve<IOrderModuleService>(Modules.ORDER)
    const paymentService = container.resolve<IPaymentModuleService>(Modules.PAYMENT)
    const inventoryService = container.resolve<IInventoryModuleService>(Modules.INVENTORY)
    const linkService = container.resolve<ILinkService>(ContainerRegistrationKeys.LINK)

    const responses = await completeCartConcurrently(cartId)

    const orders = await orderService.listOrders()
    expect(orders).toHaveLength(1)
    const orderId = orders[0]?.id

    // Both links resolve to the winner. `link-order` writes them in one transaction, so a
    // loser rejected on `order_cart.cart_id` cannot leave its payment-collection link behind
    // for `create-order`'s compensation to orphan.
    expect(await linkService.repo('orderCart').findByCartId(cartId)).toMatchObject({ orderId })
    expect(
      await linkService.repo('orderPaymentCollection').findByPaymentCollectionId(paymentCollectionId),
    ).toMatchObject({ orderId })

    // `authorizePaymentSession` guards on a SELECT, so it is only safe because the losers never
    // reach it — `link-order` fails first. Against a real PSP each extra call here would be a
    // separate authorization on the shopper's card.
    const collection = await paymentService.retrievePaymentCollection(paymentCollectionId)
    expect(collection.paymentSessions ?? []).toHaveLength(1)
    expect(collection.payments ?? []).toHaveLength(1)

    // Exactly one unit is stocked, so a second reservation would be an oversell.
    const reservations = await inventoryService.listReservationItems()
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
    const { cart } = await service.create.checkoutReadyCart(container)
    const cartId = cart.id
    const orderService = container.resolve<IOrderModuleService>(Modules.ORDER)
    const linkService = container.resolve<ILinkService>(ContainerRegistrationKeys.LINK)

    // The mirror of the concurrent case, and the one ordering alone does not cover: the
    // order↔cart link succeeds and the payment-collection link fails. Without a shared
    // transaction the first row commits, the step throws so its compensation is never
    // registered, and `create-order`'s compensation hard-deletes the order underneath it.
    vi.spyOn(linkService.repo('orderPaymentCollection'), 'create').mockRejectedValueOnce(
      new Error('payment collection link unavailable'),
    )

    const response = await request(server)
      .post(`/store/carts/${cartId}/complete`)
      .set('Content-Type', 'application/json')
      .send()

    expect(response.status).not.toBe(200)
    expect(await orderService.listOrders()).toHaveLength(0)
    expect(await linkService.repo('orderCart').findByCartId(cartId)).toBeNull()
  })
})
