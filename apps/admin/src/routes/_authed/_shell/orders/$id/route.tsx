import { createFileRoute, Outlet } from '@tanstack/react-router'
import { orderQueryOptions } from '#/features/orders/api/orders'

export const Route = createFileRoute('/_authed/_shell/orders/$id')({
  beforeLoad: async ({ context, params }) => {
    const data = await context.queryClient.ensureQueryData(orderQueryOptions(params.id))
    return { breadcrumb: `#${data.order.displayId}` }
  },
  component: () => <Outlet />,
})
