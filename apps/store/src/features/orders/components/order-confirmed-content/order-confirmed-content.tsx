import { Trans } from '@lingui/react/macro'
import { cn } from '@proteus/ui-core'
import { useSuspenseOrder } from '#/entities/order/api/orders'
import {
  orderConfirmedContent,
  orderConfirmedContentDetails,
  orderConfirmedContentHeader,
  orderConfirmedContentMessages,
  orderConfirmedContentOrder,
  orderConfirmedContentOrderTitle,
  orderConfirmedContentPlaced,
  orderConfirmedContentPlacedMessage,
  orderConfirmedContentProgress,
  orderConfirmedContentSentMessage,
  orderConfirmedContentThanks,
  orderConfirmedContentTitle,
  orderConfirmedContentTitleGroup,
} from '#/features/orders/components/order-confirmed-content/order-confirmed-content.variants'
import { OrderDetails } from '#/features/orders/components/order-details/order-details'
import { OrderProgressTrack } from '#/features/orders/components/order-progress-track/order-progress-track'
import { useFormatters } from '#/hooks/use-formatters'

/**
 * Where checkout lands. The number is printed the same way the account route prints it — one
 * order rendered two ways across two pages is the inconsistency this redesign exists to remove —
 * so it is an `h2` here, under the "Thank you!" that has to stay the `h1`.
 *
 * No back link: a guest who just checked out has nothing behind them to go back to.
 */
export function OrderConfirmedContent({ orderId }: { orderId: string }) {
  const { order } = useSuspenseOrder(orderId)
  const { formatDate } = useFormatters()
  const { displayId, email } = order
  const placedAt = formatDate(order.createdAt)

  return (
    <main className={cn(orderConfirmedContent(), 'mx-auto w-full')}>
      <div className={orderConfirmedContentHeader()}>
        <div className={orderConfirmedContentThanks()}>
          <h1 className={orderConfirmedContentTitle()}>
            <Trans>Thank you!</Trans>
          </h1>
          <div className={orderConfirmedContentMessages()}>
            <p className={orderConfirmedContentPlacedMessage()}>
              <Trans>Your order was placed successfully.</Trans>
            </p>
            {/* The address is ink inside the muted line: rich text the drawing keeps on one style. */}
            <p className={orderConfirmedContentSentMessage()}>
              <Trans>
                We have sent the order confirmation details to <span className="text-ink">{email}</span>.
              </Trans>
            </p>
          </div>
        </div>

        <div className={orderConfirmedContentOrder()}>
          <div className={orderConfirmedContentTitleGroup()}>
            <h2 className={orderConfirmedContentOrderTitle()}>
              <Trans>Order #{displayId}</Trans>
            </h2>
            <p className={orderConfirmedContentPlaced()}>
              <Trans>Placed {placedAt}</Trans>
            </p>
          </div>
          <OrderProgressTrack order={order} className={orderConfirmedContentProgress()} />
        </div>
      </div>

      <OrderDetails order={order} className={orderConfirmedContentDetails()} />
    </main>
  )
}
