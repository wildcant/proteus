import { getRouteApi } from '@tanstack/react-router'
import { useSuspenseOrder } from '#/features/orders/api/orders'
import { OrderDetails } from '#/features/orders/components/order-details'
import { OrderProgressTrack } from '#/features/orders/components/order-progress-track'
import { useFormatters } from '#/lib/use-formatters'

const route = getRouteApi('/_main/order/$orderId/confirmed')

/**
 * Where checkout lands. The number is printed the same way the account route prints it — one
 * order rendered two ways across two pages is the inconsistency this redesign exists to remove —
 * so it is an `h2` here, under the "Thank you!" that has to stay the `h1`.
 *
 * No back link: a guest who just checked out has nothing behind them to go back to.
 */
export function OrderConfirmedContent() {
  const { orderId } = route.useParams()
  const { order } = useSuspenseOrder(orderId)
  const { formatDate } = useFormatters()

  return (
    <main className="mx-auto w-full max-w-350 px-4 pt-12 pb-16 sm:px-6 lg:px-8">
      <h1 className="type-display text-ink">Thank you!</h1>
      <p className="mt-4 text-ink text-sm">Your order was placed successfully.</p>
      <p className="mt-1 text-ink-muted text-sm">
        We have sent the order confirmation details to <span className="text-ink">{order.email}</span>.
      </p>

      <h2 className="type-title mt-8 text-ink">Order #{order.displayId}</h2>
      <p className="mt-2 text-ink-muted text-sm">Placed {formatDate(order.createdAt)}</p>

      <OrderProgressTrack order={order} className="mt-6" />

      <OrderDetails order={order} />
    </main>
  )
}
