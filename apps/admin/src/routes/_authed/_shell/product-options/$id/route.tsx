import { createFileRoute, Outlet } from '@tanstack/react-router'
import { productOptionQueryOptions } from '#/features/product-options/api/product-options'

export const Route = createFileRoute('/_authed/_shell/product-options/$id')({
  beforeLoad: async ({ context, params }) => {
    const data = await context.queryClient.ensureQueryData(productOptionQueryOptions(params.id))
    return { breadcrumb: data.productOption.title }
  },
  component: () => <Outlet />,
})
