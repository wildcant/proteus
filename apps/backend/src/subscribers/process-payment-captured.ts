import { AppError, ErrorTypes } from '@core/errors/app-error.js'
import type { SubscriberArgs, SubscriberConfig } from '@core/event-bus/types.js'
import type { ILinkService } from '@core/types/link/service.js'
import type { INotificationModuleService } from '@core/types/notification/service.js'
import type { PaymentDTO } from '@core/types/payment/common.js'
import type { IPaymentModuleService } from '@core/types/payment/service.js'
import { ContainerRegistrationKeys, Modules, NotificationTemplates } from '@core/utils/index.js'
import { env } from '@env'
import { completeCartWorkflow } from '@workflows/cart/complete-cart.js'
import type { AwilixContainer } from 'awilix'

/**
 * What a payment provider's webhook actually means, done durably.
 *
 * Two things, in this order, because they are two halves of one outcome: record what the provider
 * reported, then make sure the cart behind it ends with an order.
 *
 * ## Why one subscriber and not two
 *
 * Both halves turn on `payment.captured`, and two subscribers on one event run **concurrently** —
 * so both would call `authorizePaymentSession` for the same session at the same time, and the
 * unique index on the payment's session id would make one of them lose. That loser converges on a
 * retry, which is correct on a real transport and is nothing at all under the in-process adapter,
 * where a test would see the order appear or not depending on which promise resolved first.
 *
 * In sequence there is no race to converge from: the capture writes the payment, and the completion
 * that follows finds it already there. The cost the plan names is accepted — a completion failure
 * retries the whole unit, re-running a capture that already succeeded — and that re-run is a no-op
 * against `capturedAt`.
 *
 * ## Why it is safe to run twice
 *
 * Required to be: the weaker transport is at-least-once with no dedup, and Stripe redelivers an
 * event until it is acknowledged. Every step here is a converge-on-observed-state read rather than
 * an assumption. `authorizePaymentSession` answers with the payment a previous delivery created;
 * `capturedAt` is set by the only capture there can be, so a repeat does not take the money twice;
 * and `complete-cart`'s own `check-idempotency` step returns the existing order rather than making
 * a second one. That last point is why this is a *re-run of checkout* and not a second completion
 * path — a path of its own would need its own idempotency, and would be the thing that drifts.
 */
async function processPaymentCaptured({ event, container }: SubscriberArgs<'payment.captured'>) {
  const paymentService = container.resolve<IPaymentModuleService>(Modules.PAYMENT)
  const { id: sessionId, action } = event.data

  const authorization = await paymentService.authorizePaymentSession(sessionId)

  switch (authorization.outcome) {
    /**
     * Nothing to take money against, and nothing that will change. The provider has decided: the
     * intent was declined, cancelled, or is waiting on a shopper who is not coming back. A retry
     * would ask the same question and get the same answer, so the delivery is finished with.
     */
    case 'not_authorized':
      return

    /**
     * Our own read disagrees with the event: the provider reported the money moved, and the
     * session says it is still settling. That is a gateway that has not caught up with itself, and
     * it resolves on its own — so **converge**, by failing and letting the bounded retry back off
     * until the next read is terminal.
     *
     * A delay here would be the same wait with none of the convergence: it would fix mutual
     * exclusion by guessing at a duration, which degrades exactly under the load that makes the
     * window wider.
     */
    case 'pending_authorization':
      throw new AppError({
        type: ErrorTypes.CONFLICT,
        message: `Payment session "${sessionId}" is still settling, so the "${action}" the provider reported cannot be recorded yet`,
      })

    case 'authorized': {
      /**
       * Only if the money is not already taken. `authorizePaymentSession` captures the payment
       * itself when the intent already reports a completed charge, so by here the capture may well
       * have happened. Capturing again cannot take the money twice (`capturePayment` refuses), but
       * it would raise — turning a delivery that already worked into one that failed. A capture
       * takes the whole authorization, so `capturedAt` settles it.
       */
      if (action === 'captured' && !authorization.payment.capturedAt) {
        await paymentService.capturePayment({ paymentId: authorization.payment.id })
      }

      await completeCartBehind(authorization.payment, container)
      return
    }
  }
}

/**
 * Finishes the checkout the payment belongs to, by re-running the one that already exists.
 *
 * This is the fix for the case a shopper could reach with money gone and nothing to show for it:
 * an asynchronously-settling payment (a bank redirect, ACH, a card the issuer held for review) is
 * refused by `authorize-payment` while it is still settling, the whole checkout compensates, and
 * then the capture lands. Nothing used to re-run completion, so the shopper was charged for an
 * order that did not exist.
 *
 * The compensation genuinely clears the way for the re-run: `link-order` dismisses its links and
 * `mark-cart-completed` clears `completedAt`, link dismissal is a soft delete, and the repository
 * filters soft-deleted rows — so `check-idempotency` finds nothing and proceeds.
 *
 * Unconditional, including for a checkout that succeeded synchronously. The idempotency step is
 * the answer to "has this already happened", and routing around it with a read of our own would be
 * a second answer to the same question, which is the drift this re-run exists to avoid. The
 * confirmation email comes with it and needs no code of its own: the re-run publishes `order.placed`
 * from the same final step the synchronous path does.
 */
async function completeCartBehind(payment: PaymentDTO, container: AwilixContainer): Promise<void> {
  const linkService = container.resolve<ILinkService>(ContainerRegistrationKeys.LINK)

  // A payment collection with no cart behind it is not a checkout, so there is no completion to
  // re-run. Nothing produces one today; this is what keeps that from being an exception.
  const cartLink = await linkService
    .repo('cartPaymentCollection')
    .findByPaymentCollectionId(payment.paymentCollectionId)
  if (!cartLink) return

  try {
    await completeCartWorkflow.run({ cartId: cartLink.cartId })
  } catch (error) {
    /**
     * Whether anyone is going to end up with an order, read rather than inferred from the error.
     *
     * A live `orderCart` link means another completion owns this cart — the shopper's own request,
     * or a concurrent delivery — and it is the reason this run was refused. That is not a shopper
     * who was charged for nothing, so it raises nothing; the throw below lets the bounded retry
     * converge on the order that run is creating.
     *
     * No link means the money is ours and no order came of it, which is the outcome an operator has
     * to hear about.
     */
    const orderLink = await linkService.repo('orderCart').findByCartId(cartLink.cartId)
    if (!orderLink) await alertChargedWithoutOrder({ container, cartId: cartLink.cartId, paymentId: payment.id })

    throw error
  }
}

/**
 * Tells an operator that a shopper's money was taken and no order came of it.
 *
 * **Not `complete-cart`'s existing compensation alert**, which the plan asked for and which cannot
 * work here. That alert is keyed per cart, and on this path the checkout workflow runs twice for
 * the same cart: the first attempt — the one that refused the still-settling payment — has already
 * written `checkout-failed:<cartId>`, so a second compensation on the same cart is deduped and the
 * operator hears nothing. It also says the wrong thing, reporting a rollback rather than money
 * taken. So the alert belongs here, with its own key and its own words.
 *
 * The refund is `authorize-payment`'s compensation, and it only runs for a re-run that got that
 * far. A re-run refused earlier — a shipping option withdrawn, a variant deleted — leaves the money
 * captured, so the message reports what the payment actually says rather than promising a refund
 * nobody made. That is read fresh, after the compensation has finished.
 */
async function alertChargedWithoutOrder(deps: {
  container: AwilixContainer
  cartId: string
  paymentId: string
}): Promise<void> {
  const { container, cartId, paymentId } = deps
  const paymentService = container.resolve<IPaymentModuleService>(Modules.PAYMENT)
  const notificationService = container.resolve<INotificationModuleService>(Modules.NOTIFICATION)

  const payment = await paymentService.retrievePayment(paymentId)
  const refunded = (payment.refunds ?? []).length > 0
  const money = refunded
    ? `Payment "${paymentId}" was captured and refunded.`
    : `Payment "${paymentId}" is still captured and has not been refunded.`

  await notificationService.createNotification({
    // TODO(rbac): one configured address until there is a role to ask for.
    to: env.ADMIN_NOTIFICATION_EMAIL,
    channel: 'feed',
    template: NotificationTemplates.PAYMENT_CAPTURED_WITHOUT_ORDER,
    data: {
      title: 'Payment captured, no order',
      description: `The payment for cart "${cartId}" was captured but the order could not be created. ${money}`,
    },
    triggerType: 'payment.captured.completion.failed',
    resourceType: 'cart',
    resourceId: cartId,
    // Per cart, not per delivery: the bounded retry re-runs this whole subscriber, and an operator
    // needs one alert about one shopper rather than one per attempt.
    idempotencyKey: `charged-without-order:${cartId}`,
  })
}

export const config: SubscriberConfig<'payment.captured'> = {
  name: 'process-payment-captured',
  event: 'payment.captured',
  handler: processPaymentCaptured,
}
