import { ErrorTypes } from '@core/errors/app-error.js'
import { PAYMENT_AWAITING_AUTHORIZATION } from '@core/errors/payment-authorization-code.js'
import type { INotificationModuleService } from '@core/types/notification/service.js'
import type { IPaymentModuleService } from '@core/types/payment/service.js'
import { Modules } from '@core/utils/index.js'
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
        code: PAYMENT_AWAITING_AUTHORIZATION,
        message: expect.stringContaining('has not been authorized yet'),
      },
    })

    // Unchanged, and asserted here rather than assumed: the decline keeps the type, the absent
    // code and the message it had before this ticket.
    await expect(completeCartWorkflow.run({ cartId: declined.cart.id })).rejects.toMatchObject({
      cause: {
        type: ErrorTypes.UNEXPECTED_STATE,
        code: undefined,
        message: expect.stringContaining('Payment authorization failed for session'),
      },
    })

    // Both unwind. Finishing the order once the webhook resolves the settling intent needs a
    // subscriber that does not exist yet — this ticket makes the case separable, not survivable.
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

  test('a confirmation that fails to send notifies an operator and still returns the order', async ({
    service,
    expect,
  }) => {
    const { cart } = await service.create.checkoutReadyCart(container)

    // `Once`, so only the shopper's confirmation fails — the feed row written from the catch is
    // the second call and has to get through.
    vi.spyOn(
      container.resolve<INotificationModuleService>(Modules.NOTIFICATION),
      'createNotification',
    ).mockRejectedValueOnce(new Error('mail provider unavailable'))

    const order = await completeCartWorkflow.run({ cartId: cart.id })

    // The payment is authorized by now, so the send is built never to throw. That is also why
    // `notifyOnFailureStep` cannot cover this case: no throw, no rollback, no compensation.
    expect(order).toMatchObject({ id: expect.any(String) })
    expect(await service.read.notifications(container, { channel: 'feed' })).toMatchObject([
      {
        to: env.ADMIN_NOTIFICATION_EMAIL,
        channel: 'feed',
        resourceType: 'order',
        resourceId: order.id,
        data: { title: 'Order confirmation not sent', description: expect.stringContaining(order.email) },
      },
    ])
  })

  test('refuses a cart with no email', async ({ service, expect }) => {
    const { cart } = await service.create.checkoutReadyCart(container, { cart: { email: null } })

    await expect(completeCartWorkflow.run({ cartId: cart.id })).rejects.toThrow(
      'has no email — an email is required to complete checkout',
    )
  })
})
