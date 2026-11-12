import { cn } from '@proteus/ui-core'
import type { StoreOrderResponseOrder } from '#/api/generated/model'
import { DeliveryDetails } from '#/features/orders/components/delivery-details/delivery-details'
import {
  orderDetails,
  orderDetailsDelivery,
  orderDetailsPayment,
  orderDetailsSide,
  orderDetailsSummary,
} from '#/features/orders/components/order-details/order-details.variants'
import { OrderSummary } from '#/features/orders/components/order-summary/order-summary'
import { PaymentDetails } from '#/features/orders/components/payment-details/payment-details'

/**
 * The body both order routes mount under their own header — "Thank you!" the minute after
 * checkout, the number six months later.
 *
 * The dashboard's grid, so the panels line up with the ones on the page the shopper just left
 * and opening an order does not reflow the column under them. One column on a phone, stacked in
 * DOM order, so nothing is reordered by CSS.
 */
export function OrderDetails({ order, className }: { order: StoreOrderResponseOrder; className?: string }) {
  return (
    <div className={cn(orderDetails(), className)}>
      <OrderSummary order={order} className={orderDetailsSummary()} />
      <div className={orderDetailsSide()}>
        <DeliveryDetails order={order} className={orderDetailsDelivery()} />
        <PaymentDetails order={order} className={orderDetailsPayment()} />
      </div>
    </div>
  )
}
