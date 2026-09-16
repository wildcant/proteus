import { createFileRoute, Outlet } from '@tanstack/react-router'
import { fulfillmentProvidersQueryOptions, orderQueryOptions } from '#/features/orders/api/orders'

export const Route = createFileRoute('/_authed/_shell/orders/$id')({
  beforeLoad: async ({ context, params }) => {
    const [data] = await Promise.all([
      context.queryClient.ensureQueryData(orderQueryOptions(params.id)),
      context.queryClient.ensureQueryData(fulfillmentProvidersQueryOptions()),
    ])
    return { breadcrumb: `#${data.order.displayId}` }
  },
  component: () => <Outlet />,
})
