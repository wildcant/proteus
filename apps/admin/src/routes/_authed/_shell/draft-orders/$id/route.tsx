import { createFileRoute, Outlet } from '@tanstack/react-router'
import { draftOrderQueryOptions } from '#/features/draft-orders/api/draft-orders'

export const Route = createFileRoute('/_authed/_shell/draft-orders/$id')({
  beforeLoad: async ({ context, params }) => {
    const data = await context.queryClient.ensureQueryData(draftOrderQueryOptions(params.id))
    return { breadcrumb: data.draftOrder.reference }
  },
  component: () => <Outlet />,
})
