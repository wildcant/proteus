import { Trans } from '@lingui/react/macro'
import { createFileRoute } from '@tanstack/react-router'
import { Suspense } from 'react'
import { ButtonLink } from '#/components/ui/button/button'
import { orderQueryOptions } from '#/entities/order/api/orders'
import { OrderContent } from '#/features/orders/components/order-content/order-content'
import { OrderContentSkeleton } from '#/features/orders/components/order-content-skeleton/order-content-skeleton'
import { OrderError } from '#/features/orders/components/order-error/order-error'
import { flowLinks } from '#/navigation/links'

const links = flowLinks('OrderContent')

export const Route = createFileRoute('/_main/_authed/account/orders/$orderId')({
  loader: ({ context, params }) => {
    context.queryClient.prefetchQuery(orderQueryOptions(params.orderId))
  },
  component: OrderPage,
  errorComponent: OrderDetailError,
})

function OrderPage() {
  const { orderId } = Route.useParams()
  return (
    <Suspense fallback={<OrderContentSkeleton />}>
      <OrderContent orderId={orderId} accountLink={links.BACK_TO_ACCOUNT()} />
    </Suspense>
  )
}

// TODO(monitoring): the store has no error-reporting transport, so this boundary renders
// politely and tells nobody. Wire it up here when one lands.
function OrderDetailError() {
  const { orderId } = Route.useParams()

  return (
    <OrderError orderId={orderId}>
      <ButtonLink {...links.BACK_TO_ACCOUNT()} variant="outline">
        <Trans>Back to account</Trans>
      </ButtonLink>
    </OrderError>
  )
}
