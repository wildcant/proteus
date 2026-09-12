import { ErrorTypes } from '@core/errors/app-error.js'
import type { EventBus } from '@core/event-bus/types.js'
import type { INotificationModuleService } from '@core/types/notification/service.js'
import { PaymentErrorCodes } from '@core/types/payment/errors.js'
import type { IPaymentModuleService } from '@core/types/payment/service.js'
import { ContainerRegistrationKeys } from '@core/utils/container.js'
import { Modules } from '@core/utils/modules-definition.js'
import { env } from '@env'
import type { TestContainer } from '@tests/setup/create-container.js'
import { test } from '@tests/setup/test-extend.js'
import { assertDefined } from '@tests/utils/assert-defined.js'
import { vi } from 'vitest'
import { completeCartWorkflow } from '../complete-cart.js'

let container: TestContainer

test.beforeEach(async ({ createTestContainer }) => {
  container = await createTestContainer()
})

test.describe('completeCartWorkflow', () => {
  test('turns the cart into an order, reserves its stock, and locks the cart', async ({ service, expect }) => {
    const { cart, lineItem, paymentCollection } = await service.create.checkoutReadyCart(container)
    assertDefined(paymentCollection)

    const order = await completeCartWorkflow.run({ cartId: cart.id })

    expect(order).toMatchObject({ status: 'pending', email: cart.email, currencyCode: cart.currencyCode })
    expect(await service.read.orderLineItems(container, order.id)).toMatchObject([{ title: lineItem.title }])
    expect(await service.read.orderShippingMethods(container, order.id)).toHaveLength(1)

    // Both links go out as one batch, order↔cart first so the unique index on `cartId` rejects
    // a duplicate completion before the sibling link is written.
    expect(await service.read.linkRepo(container, 'orderCart').findByCartId(cart.id)).toMatchObject({
      orderId: order.id,
    })
    expect(await service.read.linkRepo(container, 'orderPaymentCollection').findByOrderId(order.id)).toMatchObject({
      paymentCollectionId: paymentCollection.id,
    })

    expect(await service.read.reservationItems(container)).toHaveLength(1)
    expect(await service.read.cart(container, cart.id)).toMatchObject({ completedAt: expect.any(Date) })
  })

  test('a second completion returns the first order instead of making another', async ({ service, expect }) => {
    const { cart } = await service.create.checkoutReadyCart(container)
    const first = await completeCartWorkflow.run({ cartId: cart.id })

    const second = await completeCartWorkflow.run({ cartId: cart.id })

    expect(second.id).toBe(first.id)
    expect(await service.read.orders(container)).toHaveLength(1)
  })

  test('carries the shipping method payload onto the order', async ({ service, expect }) => {
    const { cart } = await service.create.checkoutReadyCart(container, {
      shippingMethod: { data: { provider: 'ups', rateId: 'R123' } },
    })

    const order = await completeCartWorkflow.run({ cartId: cart.id })

    expect(await service.read.orderShippingMethods(container, order.id)).toMatchObject([
      { data: { provider: 'ups', rateId: 'R123' } },
    ])
  })

  test('snapshots the address rather than pointing at the cart’s', async ({ dto, service, expect }) => {
    const { cart } = await service.create.checkoutReadyCart(container)
    const cartAddresses = await service.create.cartAddresses(container, cart.id, {
      shippingAddress: dto.generate.createCartAddress({
        firstName: 'John',
        lastName: 'Smith',
        city: 'Springfield',
      }),
    })
    const cartShippingAddress = cartAddresses.find((address) => address.type === 'shipping')
    assertDefined(cartShippingAddress)

    const order = await completeCartWorkflow.run({ cartId: cart.id })

    const orderAddresses = await service.read.orderAddresses(container, { orderId: order.id })
    const orderShippingAddress = orderAddresses.find((address) => address.type === 'shipping')
    assertDefined(orderShippingAddress)
    // A copy, not a reference: editing the cart address later must not rewrite the order.
    expect(orderShippingAddress.id).not.toBe(cartShippingAddress.id)
    expect(orderShippingAddress).toMatchObject({
      orderId: order.id,
      firstName: 'John',
      lastName: 'Smith',
      city: 'Springfield',
    })
  })

  test('completes a cart that has no addresses', async ({ service, expect }) => {
    const { cart } = await service.create.checkoutReadyCart(container)
    expect(await service.read.cartAddresses(container, { cartId: cart.id })).toEqual([])

    const order = await completeCartWorkflow.run({ cartId: cart.id })

    expect(order).toMatchObject({ status: 'pending' })
    expect(await service.read.orderAddresses(container, { orderId: order.id })).toEqual([])
  })

  test('a failure after the order exists unwinds every earlier step', async ({ service, expect }) => {
    const { cart } = await service.create.checkoutReadyCart(container)

    vi.spyOn(
      container.resolve<IPaymentModuleService>(Modules.PAYMENT),
      'authorizePaymentSession',
    ).mockRejectedValueOnce(new Error('provider unavailable'))

    await expect(completeCartWorkflow.run({ cartId: cart.id })).rejects.toThrow('provider unavailable')

    // Each compensation asserted on the state it restored, not on the call that restored it.
    expect(await service.read.orders(container)).toEqual([])
    expect(await service.read.linkRepo(container, 'orderCart').findByCartId(cart.id)).toBeNull()
    expect(await service.read.reservationItems(container)).toEqual([])
    expect(await service.read.cart(container, cart.id)).toMatchObject({ completedAt: null })
  })

  /**
   * The classification the cart-completion API answers with, and the whole point of ILLO-70.
   *
   * A `processing` intent and a declined card both used to raise `unexpected_state` with the
   * same message, so nothing downstream — an operator, an alert, the storefront — could tell a
   * charge still settling from a shopper who did not pay. Asserted as a pair, because either
   * error alone says nothing about whether the two are separable.
   */
  test('separates a payment still settling from a declined one, by code and by status', async ({ service, expect }) => {
    const settling = await service.create.checkoutReadyCart(container)
    const declined = await service.create.checkoutReadyCart(container)

    const paymentService = container.resolve<IPaymentModuleService>(Modules.PAYMENT)
    const authorize = vi.spyOn(paymentService, 'authorizePaymentSession')
    authorize.mockResolvedValueOnce({ outcome: 'pending_authorization' })
    authorize.mockResolvedValueOnce({ outcome: 'not_authorized', sessionStatus: 'error' })

    await expect(completeCartWorkflow.run({ cartId: settling.cart.id })).rejects.toMatchObject({
      cause: {
        type: ErrorTypes.CONFLICT,
        code: PaymentErrorCodes.AWAITING_AUTHORIZATION,
        message: expect.stringContaining('has not been authorized yet'),
      },
    })

    // The decline is a conflict too, and separable by code alone.
    await expect(completeCartWorkflow.run({ cartId: declined.cart.id })).rejects.toMatchObject({
      cause: {
        type: ErrorTypes.CONFLICT,
        code: PaymentErrorCodes.DECLINED,
        message: expect.stringContaining('declined'),
      },
    })

    // Both unwind, and that is still right here: the money is not committed at the point this
    // workflow needs it. What happens to the settling one afterwards belongs to the
    // `payment.captured` subscriber, which re-runs this workflow once the capture lands.
    expect(await service.read.orders(container)).toEqual([])
  })

  /**
   * The other three ways a session can fail to authorize, which used to share the decline's
   * `unexpected_state` and its absent code — so a 3D Secure challenge nobody finished and a bad
   * API key were one indistinguishable 500. Asserted per status, because a table that classified
   * only the status the previous test happens to use would pass while the rest stayed wrong.
   */
  test.for([
    ['pending', PaymentErrorCodes.NOT_CONFIRMED],
    ['requires_more', PaymentErrorCodes.REQUIRES_ACTION],
    ['canceled', PaymentErrorCodes.SESSION_CANCELED],
  ] as const)('refuses a %s session with a conflict and its own code', async ([status, code], { service, expect }) => {
    const { cart } = await service.create.checkoutReadyCart(container)

    vi.spyOn(
      container.resolve<IPaymentModuleService>(Modules.PAYMENT),
      'authorizePaymentSession',
    ).mockResolvedValueOnce({ outcome: 'not_authorized', sessionStatus: status })

    await expect(completeCartWorkflow.run({ cartId: cart.id })).rejects.toMatchObject({
      cause: { type: ErrorTypes.CONFLICT, code },
    })
    expect(await service.read.orders(container)).toEqual([])
  })

  test('a rolled-back checkout leaves no address rows behind', async ({ dto, service, expect }) => {
    const { cart } = await service.create.checkoutReadyCart(container)
    await service.create.cartAddresses(container, cart.id, {
      shippingAddress: dto.generate.createCartAddress(),
      billingAddress: dto.generate.createCartAddress(),
    })

    vi.spyOn(
      container.resolve<IPaymentModuleService>(Modules.PAYMENT),
      'authorizePaymentSession',
    ).mockRejectedValueOnce(new Error('provider unavailable'))

    await expect(completeCartWorkflow.run({ cartId: cart.id })).rejects.toThrow('provider unavailable')

    // The order's addresses go with the order, so a discarded checkout leaves nothing readable
    // behind: the compensation hides the order and the cascade takes its addresses with it.
    expect(await service.read.orderAddresses(container)).toEqual([])
    // The cart keeps its own — those belong to a checkout the shopper can still resume.
    expect(await service.read.cartAddresses(container, { cartId: cart.id })).toHaveLength(2)
  })

  test('refuses a line item with no variant', async ({ service, expect }) => {
    const { cart } = await service.create.checkoutReadyCart(container, {
      lineItem: { variantId: null },
      inventory: null,
    })

    await expect(completeCartWorkflow.run({ cartId: cart.id })).rejects.toThrow('has no variant')
  })

  test('an unexpected failure mid-workflow leaves an operator a feed notification', async ({ service, expect }) => {
    const { cart } = await service.create.checkoutReadyCart(container)

    vi.spyOn(
      container.resolve<IPaymentModuleService>(Modules.PAYMENT),
      'authorizePaymentSession',
    ).mockRejectedValueOnce(new Error('provider unavailable'))

    await expect(completeCartWorkflow.run({ cartId: cart.id })).rejects.toThrow('provider unavailable')

    // The rollback itself is covered above. What is asserted here is the row it leaves behind:
    // a checkout that unwinds is the one failure nobody used to hear about.
    expect(await service.read.notifications(container, { channel: 'feed' })).toMatchObject([
      {
        to: env.ADMIN_NOTIFICATION_EMAIL,
        channel: 'feed',
        resourceType: 'cart',
        resourceId: cart.id,
        // The keys the admin's notification item actually renders.
        data: { title: 'Checkout failed', description: expect.stringContaining(cart.id) },
      },
    ])
  })

  /**
   * The confirmation now leaves through the bus, from the final step, and reaches the subscriber
   * that sends it. Asserted on the notification row rather than on the emit, because the row is
   * what a shopper would receive — the publish alone would pass with nothing listening.
   *
   * The suite pins the in-process adapter, which waits for its subscribers, so the row exists by
   * the time `run` resolves. On a real transport it would not, and nothing here may be read as a
   * promise that it does.
   */
  test('sends the confirmation through an order.placed subscriber rather than inside checkout', async ({
    service,
    expect,
  }) => {
    const { cart } = await service.create.checkoutReadyCart(container)
    const bus = container.resolve<EventBus>(ContainerRegistrationKeys.EVENT_BUS)
    const emit = vi.spyOn(bus, 'emit')

    const order = await completeCartWorkflow.run({ cartId: cart.id })

    // The order's own id, not one minted in the step — see the retry test below for why.
    expect(emit).toHaveBeenCalledWith('order.placed', { id: order.id })
    expect(await service.read.notifications(container, { channel: 'email' })).toMatchObject([
      {
        to: order.email,
        template: 'order-confirmation',
        resourceType: 'order',
        resourceId: order.id,
      },
    ])
  })

  test('publishes nothing when the checkout compensates', async ({ service, expect }) => {
    const { cart } = await service.create.checkoutReadyCart(container)
    const bus = container.resolve<EventBus>(ContainerRegistrationKeys.EVENT_BUS)
    const emit = vi.spyOn(bus, 'emit')

    vi.spyOn(
      container.resolve<IPaymentModuleService>(Modules.PAYMENT),
      'authorizePaymentSession',
    ).mockRejectedValueOnce(new Error('provider unavailable'))

    await expect(completeCartWorkflow.run({ cartId: cart.id })).rejects.toThrow('provider unavailable')

    // Final-step ordering is the whole transactional story: there is no staging area and no event
    // group, so a workflow that unwinds simply never reached the emit. The absent notification is
    // the half that matters — an `order.placed` for an order that was rolled back would email a
    // shopper about a purchase that did not happen.
    expect(emit).not.toHaveBeenCalled()
    expect(await service.read.notifications(container, { channel: 'email' })).toEqual([])
  })

  /**
   * The failure this whole feature exists to remove, coming back through the other door.
   *
   * `emit` is published from the final step, after the payment is authorized. If anything under it
   * could reject, a mail outage would compensate the workflow and refund a valid order — money
   * taken, no order. The port forbids that on every adapter and the adapter tests pin the contract
   * in isolation; this pins the call site that depends on it.
   */
  test('a failing send under emit cannot compensate an authorized checkout', async ({ service, expect }) => {
    const { cart } = await service.create.checkoutReadyCart(container)

    // Under the pinned in-process adapter the subscriber is what runs beneath `emit`, so its
    // failure is the transport failure this call site has to survive.
    vi.spyOn(
      container.resolve<INotificationModuleService>(Modules.NOTIFICATION),
      'createNotification',
    ).mockRejectedValue(new Error('mail provider unavailable'))

    const order = await completeCartWorkflow.run({ cartId: cart.id })

    // The order survives and nothing unwound: no compensation ran, so the cart stays locked, the
    // reservations stand, and the payment is not refunded.
    expect(order).toMatchObject({ id: expect.any(String) })
    expect(await service.read.orders(container)).toHaveLength(1)
    expect(await service.read.linkRepo(container, 'orderCart').findByCartId(cart.id)).toMatchObject({
      orderId: order.id,
    })
    expect(await service.read.reservationItems(container)).toHaveLength(1)
    expect(await service.read.cart(container, cart.id)).toMatchObject({ completedAt: expect.any(Date) })
  })

  /**
   * The detail in this feature most likely to be got wrong, and the one that fails silently.
   *
   * The final step's action runs again when the step is retried. Because the payload's id is the
   * order's — a value `create-order` recorded before this step existed — the derived dispatch
   * identity is byte-identical on the second run, so the transport dedups it. An id minted inside
   * the action would be a new one per attempt, a new identity, and a second confirmation email with
   * nothing anywhere to say it had gone out.
   *
   * Publishing the same event again is exactly what a retried step does, so that is what this does.
   */
  test('a republished order.placed keeps one identity, so a retried step cannot double-send', async ({
    service,
    expect,
  }) => {
    const { cart } = await service.create.checkoutReadyCart(container)
    const bus = container.resolve<EventBus>(ContainerRegistrationKeys.EVENT_BUS)
    const emit = vi.spyOn(bus, 'emit')

    const order = await completeCartWorkflow.run({ cartId: cart.id })

    // Republished with what the step itself published, rather than with a payload written here —
    // an id minted inside the action would be a fresh one on the second run, and rebuilding it by
    // hand would hide exactly that.
    const published = emit.mock.calls[0]
    assertDefined(published)
    await bus.emit(...published)

    expect(await service.read.notifications(container, { channel: 'email' })).toMatchObject([{ resourceId: order.id }])
  })

  test('refuses a cart with no email', async ({ service, expect }) => {
    const { cart } = await service.create.checkoutReadyCart(container, { cart: { email: null } })

    await expect(completeCartWorkflow.run({ cartId: cart.id })).rejects.toThrow(
      'has no email — an email is required to complete checkout',
    )
  })
})
