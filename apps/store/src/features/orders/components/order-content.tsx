import { formatDate } from '@proteus/utils'
import { getRouteApi, Link } from '@tanstack/react-router'
import { ChevronLeftIcon } from 'lucide-react'
import { Button } from '#/components/button'
import { useSuspenseOrder } from '#/features/orders/api/orders'
import { OrderDetails } from '#/features/orders/components/order-details'

const route = getRouteApi('/_main/_authed/account/orders/$orderId')

/**
 * A past order, opened from the account page. Deliberately not `/order/$orderId/confirmed`:
 * that page opens with "Thank you!", which is right the minute after checkout and wrong six
 * months later. Both render the same `OrderDetails` body under their own header.
 */
export function OrderContent() {
  const { orderId } = route.useParams()
  const { order } = useSuspenseOrder(orderId)

  return (
    <main className="mx-auto w-full max-w-170 px-4 pt-8 pb-16 sm:px-6">
      <Button variant="link" render={<Link to="/account" />} className="font-medium text-ink-muted no-underline">
        <ChevronLeftIcon />
        Account
      </Button>

      <p className="mt-6 text-ink-muted text-sm">Order</p>
      <h1 className="type-title mt-2 text-ink">#{order.displayId}</h1>
      <p className="mt-2 text-ink-muted text-sm">Placed {formatDate(order.createdAt)}</p>

      <OrderDetails order={order} />
    </main>
  )
}
