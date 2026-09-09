import { ErrorTypes } from '@core/errors/app-error.js'
import type { EventBus } from '@core/event-bus/types.js'
import type { CartAddressDTO } from '@core/types/cart/common.js'
import type { ICartModuleService } from '@core/types/cart/service.js'
import type { IFulfillmentModuleService } from '@core/types/fulfillment/service.js'
import type { IInventoryModuleService } from '@core/types/inventory/service.js'
import type { ILinkService } from '@core/types/link/service.js'
import type { Logger } from '@core/types/logger.js'
import type { OrderDTO } from '@core/types/order/common.js'
import type {
  CreateOrderAddressDTO,
  CreateOrderLineItemDTO,
  CreateOrderShippingMethodDTO,
} from '@core/types/order/mutations.js'
import type { IOrderModuleService } from '@core/types/order/service.js'
import type { PaymentSessionStatus, UnauthorizedSessionStatus } from '@core/types/payment/common.js'
import { PaymentErrorCodes } from '@core/types/payment/errors.js'
import type { IPaymentModuleService } from '@core/types/payment/service.js'
import type { IRegionModuleService } from '@core/types/region/service.js'
import { ContainerRegistrationKeys, Modules, NotificationTemplates } from '@core/utils/index.js'
import { createWorkflow, WorkflowTerminalError } from '@core/workflows/types.js'
import { env } from '@env'
import { notifyOnFailureStep } from '../notification/steps/notify-on-failure.js'
import { prepareConfirmInventoryInput } from './utils/prepare-confirm-inventory-input.js'

type CompleteCartInput = { cartId: string }

const PROCESSABLE_STATUSES: PaymentSessionStatus[] = [
  'pending',
  'requires_more',
  'authorized',
  'captured',
  'pending_authorization',
]

/**
 * What each way of not being authorized answers with.
 *
 * Total over [UnauthorizedSessionStatus], so a status added to the union has to be classified here
 * rather than inheriting whatever a fallback branch guessed. All four are a `conflict`: the request
 * is well formed and the session is real, the shopper's payment simply is not in a state an order
 * can be built on. None of them is the server being broken, which is what a 500 would claim — and
 * claiming it pages an operator every time a card bounces.
 */
const REFUSAL_BY_STATUS: Record<UnauthorizedSessionStatus, { code: PaymentErrorCodes; message: string }> = {
  error: {
    code: PaymentErrorCodes.DECLINED,
    message: 'The payment was declined. Please try another payment method.',
  },
  pending: {
    code: PaymentErrorCodes.NOT_CONFIRMED,
    message: 'The payment has not been confirmed yet.',
  },
  // biome-ignore lint/style/useNamingConvention: mirrors the PaymentSessionStatus union member
  requires_more: {
    code: PaymentErrorCodes.REQUIRES_ACTION,
    message: 'The payment needs to be confirmed with your bank before the order can be placed.',
  },
  canceled: {
    code: PaymentErrorCodes.SESSION_CANCELED,
    message: 'The payment was cancelled. Please start the payment again.',
  },
}

// TODO(locking): No distributed lock guards this workflow. Concurrent calls for the same cart
// can produce duplicate orders. Add acquireLock/releaseLock steps once a locking module is available.
export const completeCartWorkflow = createWorkflow<CompleteCartInput, OrderDTO>(
  { name: 'complete-cart', throws: [ErrorTypes.CONFLICT, ErrorTypes.INVALID_DATA, ErrorTypes.NOT_ALLOWED] },
  async (ctx, input) => {
    /** If this cart was already completed (e.g. retry or concurrent request), return the
     *  existing order instead of creating a duplicate. */
    const existingOrder = await ctx.step('check-idempotency', async ({ container }) => {
      const linkService = container.resolve<ILinkService>(ContainerRegistrationKeys.LINK)
      const orderCartLink = await linkService.repo('orderCart').findByCartId(input.cartId)
      if (!orderCartLink) return null

      const cartService = container.resolve<ICartModuleService>(Modules.CART)
      const cart = await cartService.retrieveCart(input.cartId)

      /** A linked order without `completedAt` is the winner of a concurrent completion still
       *  in flight: it writes the link at `link-order` and stamps `completedAt` several steps
       *  later. A checkout that genuinely died mid-way leaves byte-identical state, and nothing
       *  readable here separates the two — so both get the same answer. The order cannot be
       *  returned yet either way, because payment is not authorized until after this gap and
       *  the whole run can still compensate away. */
      if (!cart.completedAt) {
        throw new WorkflowTerminalError({
          type: ErrorTypes.CONFLICT,
          message: `Cart "${input.cartId}" is already being completed`,
        })
      }

      const orderService = container.resolve<IOrderModuleService>(Modules.ORDER)
      return orderService.retrieveOrder(orderCartLink.orderId)
    })

    if (existingOrder) return existingOrder

    /** Reject carts with no items, missing variants, or zero/negative quantities early,
     *  before any side effects (order creation, payment) happen. */
    await ctx.step('validate-cart-items', async ({ container }) => {
      const cartService = container.resolve<ICartModuleService>(Modules.CART)
      const lineItems = await cartService.listLineItems({ cartId: input.cartId })

      if (lineItems.length === 0) {
        throw new WorkflowTerminalError({
          type: ErrorTypes.INVALID_DATA,
          message: `Cart "${input.cartId}" has no items`,
        })
      }

      for (const item of lineItems) {
        if (!item.variantId) {
          throw new WorkflowTerminalError({
            type: ErrorTypes.INVALID_DATA,
            message: `Cart item "${item.id}" has no variant`,
          })
        }
        if (item.quantity <= 0) {
          throw new WorkflowTerminalError({
            type: ErrorTypes.INVALID_DATA,
            message: `Cart item "${item.id}" has invalid quantity: ${item.quantity}`,
          })
        }
      }
    })

    /** Ensure a payment session exists and is in a processable state before proceeding.
     *  Returns the session/collection IDs needed by the authorize step later. */
    const paymentInfo = await ctx.step('validate-cart-payments', async ({ container }) => {
      const paymentService = container.resolve<IPaymentModuleService>(Modules.PAYMENT)
      const linkService = container.resolve<ILinkService>(ContainerRegistrationKeys.LINK)

      const cartPaymentLink = await linkService.repo('cartPaymentCollection').findByCartId(input.cartId)
      if (!cartPaymentLink) {
        throw new WorkflowTerminalError({
          type: ErrorTypes.INVALID_DATA,
          message: `Cart "${input.cartId}" has no payment collection`,
        })
      }

      const collection = await paymentService.retrievePaymentCollection(cartPaymentLink.paymentCollectionId)
      /** Every session on the collection, newest first — the payment module orders them, because a
       *  collection routinely holds more than one. Picking a payment method again opens a session
       *  beside the one already there and nothing removes the old one: deleting it is a call to the
       *  provider with nothing to compensate it. So this step is not reading "the" session, it is
       *  choosing which of them may authorize this collection. */
      const sessions = collection.paymentSessions ?? []
      const [newest] = sessions
      if (!newest) {
        throw new WorkflowTerminalError({
          type: ErrorTypes.INVALID_DATA,
          message: `Payment collection "${collection.id}" has no payment session — call POST /store/payment-collections/:id/payment-sessions first`,
        })
      }

      const processable = sessions.filter((session) => PROCESSABLE_STATUSES.includes(session.status))
      const [newestProcessable] = processable
      if (!newestProcessable) {
        throw new WorkflowTerminalError({
          type: ErrorTypes.INVALID_DATA,
          message: `Payment session "${newest.id}" is not processable (status: ${newest.status})`,
        })
      }

      /** A session carries its own amount and currency, copied off the collection when it was
       *  opened, and a market switch restates the collection without touching them. Authorizing one
       *  that no longer agrees charges the money the shopper was quoted before the switch for a cart
       *  priced after it — so the one that authorizes has to be one that still agrees, and it has to
       *  be settled here, before `authorize-payment` charges anyone.
       *
       *  Searching rather than checking the newest: opening a session again is exactly what the
       *  refusal below asks for, so the agreeing one is usually the newest but never has to be. */
      const authorizable = processable.find(
        (session) => session.amount.isEqualTo(collection.amount) && session.currencyCode === collection.currencyCode,
      )
      if (!authorizable) {
        throw new WorkflowTerminalError({
          type: ErrorTypes.INVALID_DATA,
          message:
            `Payment session "${newestProcessable.id}" was opened for ${newestProcessable.amount} ` +
            `${newestProcessable.currencyCode.toUpperCase()} but this cart is now ${collection.amount} ` +
            `${collection.currencyCode.toUpperCase()} — reopen the payment session to pay what the cart now says`,
        })
      }

      return {
        sessionId: authorizable.id,
        paymentCollectionId: cartPaymentLink.paymentCollectionId,
        amount: collection.amount,
      }
    })

    /** Verify a shipping method is selected and its underlying option is still enabled.
     *  Options can be disabled between cart creation and checkout. */
    await ctx.step('validate-shipping', async ({ container }) => {
      const cartService = container.resolve<ICartModuleService>(Modules.CART)
      const fulfillmentService = container.resolve<IFulfillmentModuleService>(Modules.FULFILLMENT)

      const shippingMethods = await cartService.listShippingMethods({ cartId: input.cartId })

      if (shippingMethods.length === 0) {
        throw new WorkflowTerminalError({
          type: ErrorTypes.INVALID_DATA,
          message: `Cart "${input.cartId}" has no shipping method — call POST /store/carts/:id/shipping-methods first`,
        })
      }

      await Promise.all(
        shippingMethods.map(async (sm) => {
          if (!sm.shippingOptionId) return
          const option = await fulfillmentService.retrieveShippingOption(sm.shippingOptionId)
          if (!option.isEnabled) {
            throw new WorkflowTerminalError({
              type: ErrorTypes.INVALID_DATA,
              message: `Shipping option "${sm.shippingOptionId}" is no longer available`,
            })
          }
        }),
      )
    })

    /** The market a cart is priced for and the country it delivers to have to be the same market's.
     *
     *  They can disagree with nothing wrong upstream. A shopper whose market switch was refused —
     *  a line the new market cannot sell — keeps a cart priced for the market they left, while the
     *  address checkout writes at submit comes from the market they are looking at. Everything in
     *  between resolves off the cart's region: the couriers offered, the payment methods, the money.
     *  The order that comes out is settled in a currency the shopper was never quoted, shipped by a
     *  carrier that does not serve the address on it.
     *
     *  The rule is not new. `update-cart` already refuses to move a cart into a market that does not
     *  ship to its address; this is the same invariant at the one moment left that can still break it.
     *
     *  Two cases are deliberately not this failure: a cart with no delivery country, which the
     *  address and order steps own, and a cart whose region lists no country at all, where refusing
     *  would turn a half-configured market into a checkout outage. */
    await ctx.step('validate-delivery-region', async ({ container }) => {
      const cartService = container.resolve<ICartModuleService>(Modules.CART)
      const cart = await cartService.retrieveCart(input.cartId)
      if (!cart.regionId) return

      const [shippingAddress] = await cartService.listCartAddresses({ cartId: input.cartId, type: 'shipping' })
      const countryCode = shippingAddress?.countryCode?.toLowerCase()
      if (!countryCode) return

      const regionService = container.resolve<IRegionModuleService>(Modules.REGION)
      const countries = await regionService.listCountries({ regionId: cart.regionId })
      if (countries.length === 0) return
      if (countries.some((country) => country.id === countryCode)) return

      // Retrieved only here, on the refusal, so the happy path pays for one read rather than two.
      // The region exists: a country row named it.
      const region = await regionService.retrieveRegion(cart.regionId)
      // TODO(ux): the message asks the shopper to do something the storefront cannot help with. It
      // is prose, so both remedies are theirs to carry out by hand, and working out which lines the
      // market they are looking at cannot sell is guesswork. Carry the offending line items and the
      // cart's region on the error instead, so checkout can render the blocked lines with a remove
      // action beside each and a "switch back to <region>" button. Those lines are the same ones
      // `reprice-line-items` in `update-cart` refuses the switch over, one at a time; naming all of
      // them wants that step to collect its failures instead of throwing on the first.
      throw new WorkflowTerminalError({
        type: ErrorTypes.INVALID_DATA,
        message:
          `This cart is priced for "${region.name}", which does not ship to "${countryCode}" — ` +
          'switch back to that market, or take out what this one cannot sell so the cart can move here',
      })
    })

    /** Final guard against completing a cart that was already finalized. This catches the
     *  window between the idempotency check and order creation (no locking yet). */
    await ctx.step('check-cart-not-completed', async ({ container }) => {
      const cartService = container.resolve<ICartModuleService>(Modules.CART)
      const cart = await cartService.retrieveCart(input.cartId)
      if (cart.completedAt) {
        throw new WorkflowTerminalError({
          type: ErrorTypes.NOT_ALLOWED,
          message: `Cart "${input.cartId}" is already completed`,
        })
      }
    })

    /** Every order needs an email for receipts and communication. Reject early
     *  before any side effects if the guest never provided one. The validated address is returned
     *  rather than re-read at `create-order`, so the order's non-null `email` is narrowed here
     *  instead of asserted there. */
    const email = await ctx.step('validate-cart-email', async ({ container }) => {
      const cartService = container.resolve<ICartModuleService>(Modules.CART)
      const cart = await cartService.retrieveCart(input.cartId)
      if (!cart.email) {
        throw new WorkflowTerminalError({
          type: ErrorTypes.INVALID_DATA,
          message: `Cart "${input.cartId}" has no email — an email is required to complete checkout`,
        })
      }
      return cart.email
    })

    /** Tells an operator when a checkout unwinds — the one event in this workflow nobody hears
     *  about today. The step is compensation-only: the forward path is a no-op, so this writes
     *  nothing on a successful checkout.
     *
     *  Registered here, in front of every step that has a compensation, because compensations run
     *  in reverse registration order. Notifying last means the notification describes a rollback
     *  that has already finished rather than one still in progress. */
    await notifyOnFailureStep(ctx, {
      notifications: [
        {
          // TODO(rbac): one configured address until there is a role to ask for.
          to: env.ADMIN_NOTIFICATION_EMAIL,
          channel: 'feed',
          template: NotificationTemplates.CHECKOUT_FAILED,
          data: {
            title: 'Checkout failed',
            description: `Cart "${input.cartId}" could not be completed. The order, its reservations and the cart lock were rolled back.`,
          },
          triggerType: 'cart.completion.failed',
          resourceType: 'cart',
          resourceId: input.cartId,
          // A retried workflow must not stack up alerts for the same cart.
          idempotencyKey: `checkout-failed:${input.cartId}`,
        },
      ],
    })

    /** Snapshot the cart into an immutable order record.
     * If anything after this point fails, compensation deletes the order. */
    const order = await ctx.step(
      'create-order',
      async ({ container }) => {
        const logger = container.resolve<Logger>(ContainerRegistrationKeys.LOGGER)
        const cartService = container.resolve<ICartModuleService>(Modules.CART)
        const orderService = container.resolve<IOrderModuleService>(Modules.ORDER)

        const cart = await cartService.retrieveCart(input.cartId)

        /** The order's addresses are rows it owns, so they are nested into the creation payload
         *  rather than created first and pointed at — the order has to exist before they can.
         *  Copied field by field, so editing the cart's address later cannot rewrite the order's. */
        const cartAddresses = await cartService.listCartAddresses({ cartId: input.cartId })
        const snapshotAddress = (source: CartAddressDTO | undefined): CreateOrderAddressDTO | undefined => {
          if (!source) return undefined
          const { id, cartId, type, createdAt, updatedAt, deletedAt, ...fields } = source
          return fields
        }

        const lineItems = await cartService.listLineItems({ cartId: input.cartId })
        const orderLineItems: CreateOrderLineItemDTO[] = lineItems.map((item) => ({
          title: item.title,
          subtitle: item.subtitle,
          thumbnail: item.thumbnail,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          compareAtUnitPrice: item.compareAtUnitPrice,
          variantId: item.variantId,
          productId: item.productId,
          productTitle: item.productTitle,
          productDescription: item.productDescription,
          productSubtitle: item.productSubtitle,
          productType: item.productType,
          productHandle: item.productHandle,
          variantSku: item.variantSku,
          variantBarcode: item.variantBarcode,
          variantTitle: item.variantTitle,
          variantOptionValues: item.variantOptionValues,
          requiresShipping: item.requiresShipping,
        }))

        const shippingMethods = await cartService.listShippingMethods({ cartId: input.cartId })
        const orderShippingMethods: CreateOrderShippingMethodDTO[] = shippingMethods.map((method) => ({
          name: method.name,
          description: method.description,
          amount: method.amount,
          shippingOptionId: method.shippingOptionId,
          data: method.data ?? undefined,
        }))

        const createdOrder = await orderService.createOrder({
          email,
          customerId: cart.customerId,
          currencyCode: cart.currencyCode,
          shippingAddress: snapshotAddress(cartAddresses.find((address) => address.type === 'shipping')),
          billingAddress: snapshotAddress(cartAddresses.find((address) => address.type === 'billing')),
          items: orderLineItems,
          shippingMethods: orderShippingMethods,
        })

        logger.debug(`[complete-cart] Created order "${createdOrder.id}" from cart "${input.cartId}"`)

        return createdOrder
      },
      async (createdOrder, { container }) => {
        const orderService = container.resolve<IOrderModuleService>(Modules.ORDER)
        await orderService.softDeleteOrders([createdOrder.id])
      },
    )

    /** Cross-module links enable the idempotency check (order↔cart) and let other modules
     *  discover the order's payment collection (order↔paymentCollection). Created together so a
     *  concurrent completion that loses the race on `orderCart` leaves nothing behind. */
    await ctx.step(
      'link-order',
      async ({ container }) => {
        const linkService = container.resolve<ILinkService>(ContainerRegistrationKeys.LINK)
        await linkService.createMany([
          // Most constrained first: `cartId` is unique, so a duplicate completion stops here.
          { link: 'orderCart', data: { orderId: order.id, cartId: input.cartId } },
          {
            link: 'orderPaymentCollection',
            data: { orderId: order.id, paymentCollectionId: paymentInfo.paymentCollectionId },
          },
        ])
      },
      async (_result, { container }) => {
        const linkService = container.resolve<ILinkService>(ContainerRegistrationKeys.LINK)
        await linkService.dismissLinks({ orderId: [order.id] })
      },
    )

    /** Reserve inventory so the purchased quantities can't be oversold between now
     *  and fulfillment. Reservations are released if later steps fail. */
    await ctx.step(
      'reserve-inventory',
      async ({ container }) => {
        const cartService = container.resolve<ICartModuleService>(Modules.CART)
        const inventoryService = container.resolve<IInventoryModuleService>(Modules.INVENTORY)
        const linkService = container.resolve<ILinkService>(ContainerRegistrationKeys.LINK)

        const lineItems = await cartService.listLineItems({ cartId: input.cartId })
        const variantIds = lineItems.map((li) => li.variantId).filter((id) => id != null)
        if (variantIds.length === 0) return []

        const mappings = await linkService.repo('productVariantInventoryItem').findByVariantIds(variantIds)
        const inventoryItemIds = [...new Set(mappings.map((m) => m.inventoryItemId))]
        const levels = await inventoryService.listInventoryLevels({ inventoryItemId: inventoryItemIds })

        const confirmInput = prepareConfirmInventoryInput({
          cartId: input.cartId,
          lineItems,
          mappings,
          levels,
        })

        if (confirmInput.items.length === 0) return []

        const reservations = await inventoryService.createReservationItems(
          confirmInput.items.map((item) => ({
            inventoryItemId: item.inventoryItemId,
            locationId: item.locationIds[0] ?? '',
            quantity: item.quantity * item.requiredQuantity,
            lineItemId: item.lineItemId,
          })),
        )

        return reservations.map((r) => r.id)
      },
      async (ids, { container }) => {
        if (ids.length === 0) return
        const inventoryService = container.resolve<IInventoryModuleService>(Modules.INVENTORY)
        await inventoryService.softDeleteReservationItems(ids)
      },
    )

    /** Stamp `completedAt` so the cart can't be modified or re-checked-out — that timestamp is the
     *  cart's only state. Placed before payment auth so a failure there still leaves it locked. */
    await ctx.step(
      'mark-cart-completed',
      async ({ container }) => {
        const cartService = container.resolve<ICartModuleService>(Modules.CART)
        await cartService.updateCart(input.cartId, { completedAt: new Date() })
      },
      async (_result, { container }) => {
        const cartService = container.resolve<ICartModuleService>(Modules.CART)
        await cartService.updateCart(input.cartId, { completedAt: null })
      },
    )

    /** Authorize the payment session. Placed last to minimize the window where a payment
     *  needs reversal. The provider may auto-capture (e.g. Stripe in automatic mode), in
     *  which case the returned payment already has captures — we don't force a separate
     *  capture call, so deferred flows (bank transfers, manual capture) work correctly. */
    const authorizedPayment = await ctx.step(
      'authorize-payment',
      async ({ container }) => {
        const logger = container.resolve<Logger>(ContainerRegistrationKeys.LOGGER)
        const paymentService = container.resolve<IPaymentModuleService>(Modules.PAYMENT)

        logger.debug(
          `[complete-cart] Authorizing payment session "${paymentInfo.sessionId}" for cart "${input.cartId}"`,
        )

        const authorization = await paymentService.authorizePaymentSession(paymentInfo.sessionId)

        /** Confirmed at the gateway and still settling — money in flight, not a shopper who did
         *  not pay. Its own `code` so the two are separable in a response body and in an alert,
         *  distinct from the [PaymentErrorCodes.DECLINED] a refused card answers with.
         *
         *  It is still a failure, and the workflow still unwinds — there is no order to build on
         *  money the provider has not committed. What finishes the job is the `payment.captured`
         *  subscriber: when the capture lands it re-runs this workflow for the same cart, and
         *  `check-idempotency` is what keeps that one order rather than two. */
        if (authorization.outcome === 'pending_authorization') {
          throw new WorkflowTerminalError({
            type: ErrorTypes.CONFLICT,
            code: PaymentErrorCodes.AWAITING_AUTHORIZATION,
            message: `Payment for session "${paymentInfo.sessionId}" has not been authorized yet`,
          })
        }

        if (authorization.outcome === 'not_authorized') {
          const refusal = REFUSAL_BY_STATUS[authorization.sessionStatus]
          throw new WorkflowTerminalError({
            type: ErrorTypes.CONFLICT,
            code: refusal.code,
            message: refusal.message,
          })
        }

        return authorization.payment
      },
      async (payment, { container }) => {
        const logger = container.resolve<Logger>(ContainerRegistrationKeys.LOGGER)
        const paymentService = container.resolve<IPaymentModuleService>(Modules.PAYMENT)

        const hasCaptured = payment.captures && payment.captures.length > 0
        if (hasCaptured) {
          logger.debug(`[complete-cart] Compensating: refunding payment "${payment.id}"`)
          await paymentService.refundPayment({ paymentId: payment.id, amount: payment.amount }).catch((error) => {
            logger.error(error)
          })
        } else {
          logger.debug(`[complete-cart] Compensating: canceling payment "${payment.id}"`)
          await paymentService.cancelPayment(payment.id).catch((error) => {
            logger.error(error)
          })
        }
      },
    )

    /** Record order transactions for any captures the provider already performed. The order
     *  module tracks its own ledger independently of the payment module. If the provider only
     *  authorized (no captures yet), transactions are recorded later when capture happens
     *  (e.g. at fulfillment). */
    await ctx.step('record-transactions', async ({ container }) => {
      const captures = authorizedPayment.captures ?? []
      if (captures.length === 0) return

      const orderService = container.resolve<IOrderModuleService>(Modules.ORDER)
      await Promise.all(
        captures.map((capture) =>
          orderService.addOrderTransaction({
            orderId: order.id,
            amount: capture.amount,
            currencyCode: authorizedPayment.currencyCode,
            reference: 'capture',
            referenceId: capture.id,
          }),
        ),
      )
    })

    /** Announce the order and finish. The confirmation email is sent by the `send-order-confirmation`
     *  subscriber, off this workflow's critical path — the shopper no longer waits on a mail
     *  provider, and a send that fails is retried by the transport instead of being swallowed here.
     *
     *  **This is the final step, and that ordering is the entire transactional story.** There is no
     *  staging area and no event group: a workflow that fails earlier simply never reaches this
     *  line, so a compensated checkout publishes nothing.
     *
     *  A bare `await` with no `try` around it, deliberately. `emit` never rejects — the port's
     *  contract on every adapter (`core/event-bus/types.ts`), because the payment is authorized by
     *  now and a rejection here would compensate the workflow and refund a valid order over a
     *  transport blip. A defensive catch would be dead code against a signature that cannot fail,
     *  and it would re-add the swallowing this step exists to delete.
     *
     *  The id is `order.id` — a value the `create-order` step already recorded, not one minted
     *  here. That is what keeps the dispatch identity the same when this step is retried; an id
     *  created inside this action would be new per attempt, and a second confirmation would go out
     *  with nothing to say it had. */
    await ctx.step('publish-order-placed', async ({ container }) => {
      const bus = container.resolve<EventBus>(ContainerRegistrationKeys.EVENT_BUS)
      await bus.emit('order.placed', { id: order.id })
    })

    return order
  },
)
