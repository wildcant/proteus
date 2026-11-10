import { createFileRoute, Outlet } from '@tanstack/react-router'
import { collectionQueryOptions } from '#/features/collections/api/collections'

export const Route = createFileRoute('/_authed/_shell/collections/$id')({
  beforeLoad: async ({ context, params }) => {
    const data = await context.queryClient.ensureQueryData(collectionQueryOptions(params.id))
    return { breadcrumb: data.collection.title }
  },
  component: () => <Outlet />,
})
