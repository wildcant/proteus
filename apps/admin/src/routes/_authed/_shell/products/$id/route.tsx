import { createFileRoute, Outlet } from '@tanstack/react-router'
import { productQueryOptions } from '#/features/products/api/products'

export const Route = createFileRoute('/_authed/_shell/products/$id')({
  beforeLoad: async ({ context, params }) => {
    const data = await context.queryClient.ensureQueryData(productQueryOptions(params.id))
    return { breadcrumb: data.product.title }
  },
  component: () => <Outlet />,
})
