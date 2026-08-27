import type { StoreOrderResponseOrder } from '#/api/generated/model'
import { DeliveryDetails } from './delivery-details'
import { OrderSummary } from './order-summary'
import { PaymentDetails } from './payment-details'

/**
 * The body both order routes mount under their own header — "Thank you!" the minute after
 * checkout, the number six months later.
 *
 * The dashboard's grid, so the panels line up with the ones on the page the shopper just left
 * and opening an order does not reflow the column under them. One column on a phone, stacked in
 * DOM order, so nothing is reordered by CSS.
 */
export function OrderDetails({ order }: { order: StoreOrderResponseOrder }) {
  return (
    <div className="mt-10 grid gap-4 lg:grid-cols-3">
      <OrderSummary order={order} className="lg:col-span-2" />
      <div className="flex flex-col gap-4">
        <DeliveryDetails order={order} />
        <PaymentDetails order={order} />
      </div>
    </div>
  )
}
