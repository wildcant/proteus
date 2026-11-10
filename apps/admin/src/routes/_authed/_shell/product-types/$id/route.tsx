import { createFileRoute, Outlet } from '@tanstack/react-router'
import { productTypeQueryOptions } from '#/features/product-types/api/product-types'

export const Route = createFileRoute('/_authed/_shell/product-types/$id')({
  beforeLoad: async ({ context, params }) => {
    const data = await context.queryClient.ensureQueryData(productTypeQueryOptions(params.id))
    return { breadcrumb: data.type.value }
  },
  component: () => <Outlet />,
})
