import { createFileRoute, Outlet } from '@tanstack/react-router'
import { regionQueryOptions } from '#/features/regions/api/regions'

export const Route = createFileRoute('/_authed/settings/regions/$id')({
  beforeLoad: async ({ context, params }) => {
    const data = await context.queryClient.ensureQueryData(regionQueryOptions(params.id))
    return { breadcrumb: data.region.name }
  },
  component: () => <Outlet />,
})
