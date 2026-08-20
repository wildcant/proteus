import { formatDate } from '@proteus/utils'
import { createFileRoute, Link } from '@tanstack/react-router'
import { Button } from '#/components/button'
import { useOrder } from '#/features/orders/api/orders'
import { OrderDetails } from '#/features/orders/components/order-details'

export const Route = createFileRoute('/_main/order/$orderId/confirmed')({
  component: OrderConfirmedPage,
})

function OrderConfirmedPage() {
  const { orderId } = Route.useParams()
  const { order, isLoading } = useOrder(orderId)

  if (isLoading) {
    return (
      <main className="mx-auto w-full max-w-170 px-4 pb-16 pt-12 sm:px-6">
        <p className="text-(--foreground-muted)">Loading order details...</p>
      </main>
    )
  }

  if (!order) {
    return (
      <main className="mx-auto w-full max-w-170 px-4 pb-16 pt-12 sm:px-6">
        <h1 className="text-2xl font-bold text-foreground">Order not found</h1>
        <Button render={<Link to="/" />} variant="outline" className="mt-8">
          Continue shopping
        </Button>
      </main>
    )
  }

  return (
    <main className="mx-auto w-full max-w-170 px-4 pb-16 pt-12 sm:px-6">
      <h1 className="text-2xl font-bold text-foreground">Thank you!</h1>
      <h2 className="mt-2 text-xl font-bold text-foreground">Your order was placed successfully.</h2>

      <p className="mt-4 text-sm text-(--foreground-muted)">
        We have sent the order confirmation details to{' '}
        <span className="font-semibold text-foreground">{order.email}</span>.
      </p>

      <p className="text-sm text-(--foreground-muted)">Order date: {formatDate(order.createdAt)}</p>
      <p className="text-sm">
        <span className="text-blue-600">Order number: {order.displayId}</span>
      </p>

      <OrderDetails order={order} />
    </main>
  )
}
