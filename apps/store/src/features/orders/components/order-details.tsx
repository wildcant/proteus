import { Separator } from '@proteus/ui'
import type { StoreOrderResponseOrder } from '#/api/generated/model'
import { DeliveryDetails } from './delivery-details'
import { NeedHelp } from './need-help'
import { OrderSummary } from './order-summary'
import { PaymentDetails } from './payment-details'

export function OrderDetails({ order }: { order: StoreOrderResponseOrder }) {
  return (
    <>
      <OrderSummary order={order} />
      <Separator className="my-8" />
      <DeliveryDetails order={order} />
      <Separator className="my-8" />
      <PaymentDetails order={order} />
      <Separator className="my-8" />
      <NeedHelp />
    </>
  )
}
