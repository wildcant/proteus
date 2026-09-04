import { getRouteApi, Link } from '@tanstack/react-router'
import { ChevronLeftIcon } from 'lucide-react'
import { Button } from '#/components/button'
import { useSuspenseOrder } from '#/features/orders/api/orders'
import { OrderDetails } from '#/features/orders/components/order-details'
import { OrderProgressTrack } from '#/features/orders/components/order-progress-track'
import { useFormatters } from '#/lib/use-formatters'

const route = getRouteApi('/_main/_authed/account/orders/$orderId')

/**
 * A past order, opened from the account page. Deliberately not `/order/$orderId/confirmed`:
 * that page opens with "Thank you!", which is right the minute after checkout and wrong six
 * months later. Both render the same `OrderDetails` body under their own header.
 */
export function OrderContent() {
  const { orderId } = route.useParams()
  const { order } = useSuspenseOrder(orderId)
  const { formatDate } = useFormatters()

  return (
    <main className="mx-auto w-full max-w-350 px-4 pt-8 pb-16 sm:px-6 lg:px-8">
      <Button variant="link" render={<Link to="/account" />} className="font-medium text-ink-muted no-underline">
        <ChevronLeftIcon />
        Account
      </Button>

      {/* The word that was an eyebrow above the number is inside the heading now. A screen
          reader announced the old pair as "heading level one, number one", because the eyebrow
          was a separate paragraph and the number alone is not a name for anything. */}
      <h1 className="type-title mt-6 text-ink">Order #{order.displayId}</h1>
      <p className="mt-2 text-ink-muted text-sm">Placed {formatDate(order.createdAt)}</p>

      {/* The status was the second half of the line above. It is the question this page is
          opened to answer, so it gets its own row and shows how far along it is. */}
      <OrderProgressTrack order={order} className="mt-6" />

      <OrderDetails order={order} />
    </main>
  )
}
