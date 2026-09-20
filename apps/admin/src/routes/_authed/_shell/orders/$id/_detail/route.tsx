import { useSuspenseQuery } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { TwoColumnPageSkeleton } from '#/components/common/skeleton'
import { PageLayout } from '#/components/layout/page-layout'
import { orderQueryOptions } from '#/features/orders/api/orders'
import { OrderCustomerSection } from '#/features/orders/components/order-customer-section'
import { OrderFulfillmentSection } from '#/features/orders/components/order-fulfillment-section'
import { OrderGeneralSection } from '#/features/orders/components/order-general-section'
import { OrderPaymentSection } from '#/features/orders/components/order-payment-section'
import { OrderSummarySection } from '#/features/orders/components/order-summary-section'

export const Route = createFileRoute('/_authed/_shell/orders/$id/_detail')({
  pendingComponent: () => <TwoColumnPageSkeleton mainSections={3} sidebarSections={1} />,
  component: OrderDetailLayout,
})

function OrderDetailLayout() {
  const { id } = Route.useParams()
  const { data } = useSuspenseQuery(orderQueryOptions(id))

  return (
    <PageLayout.TwoColumn>
      <PageLayout.TwoColumn.Main>
        <OrderGeneralSection order={data.order} />
        <OrderSummarySection order={data.order} />
        <OrderFulfillmentSection order={data.order} />
        <OrderPaymentSection order={data.order} />
      </PageLayout.TwoColumn.Main>
      <PageLayout.TwoColumn.Side>
        <OrderCustomerSection order={data.order} />
      </PageLayout.TwoColumn.Side>
    </PageLayout.TwoColumn>
  )
}
