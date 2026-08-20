import { formatDate } from '@proteus/utils'
import { getRouteApi, Link } from '@tanstack/react-router'
import { Button } from '#/components/button'
import { useSuspenseOrder } from '#/features/orders/api/orders'
import { OrderDetails } from '#/features/orders/components/order-details'

const route = getRouteApi('/_main/order/$orderId/confirmed')

export function OrderConfirmedContent() {
  const { orderId } = route.useParams()
  const { order } = useSuspenseOrder(orderId)

  if (!order) {
    return (
      <main className="mx-auto w-full max-w-170 px-4 pt-12 pb-16 sm:px-6">
        <h1 className="font-bold text-2xl text-foreground">Order not found</h1>
        <Button render={<Link to="/" />} variant="outline" className="mt-8">
          Continue shopping
        </Button>
      </main>
    )
  }

  return (
    <main className="mx-auto w-full max-w-170 px-4 pt-12 pb-16 sm:px-6">
      <h1 className="font-bold text-2xl text-foreground">Thank you!</h1>
      <h2 className="mt-2 font-bold text-foreground text-xl">Your order was placed successfully.</h2>

      <p className="mt-4 text-(--foreground-muted) text-sm">
        We have sent the order confirmation details to{' '}
        <span className="font-semibold text-foreground">{order.email}</span>.
      </p>

      <p className="text-(--foreground-muted) text-sm">Order date: {formatDate(order.createdAt)}</p>
      <p className="text-sm">
        <span className="text-blue-600">Order number: {order.displayId}</span>
      </p>

      <OrderDetails order={order} />
    </main>
  )
}
