import { createFileRoute, Outlet } from '@tanstack/react-router'
import { categoryQueryOptions } from '#/features/categories/api/categories'

export const Route = createFileRoute('/_authed/_shell/categories/$id')({
  beforeLoad: async ({ context, params }) => {
    const data = await context.queryClient.ensureQueryData(categoryQueryOptions(params.id))
    return { breadcrumb: data.productCategory.name }
  },
  component: () => <Outlet />,
})
