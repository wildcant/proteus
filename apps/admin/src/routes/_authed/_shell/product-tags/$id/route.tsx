import { createFileRoute, Outlet } from '@tanstack/react-router'
import { productTagQueryOptions } from '#/features/product-tags/api/product-tags'

export const Route = createFileRoute('/_authed/_shell/product-tags/$id')({
  beforeLoad: async ({ context, params }) => {
    const data = await context.queryClient.ensureQueryData(productTagQueryOptions(params.id))
    return { breadcrumb: data.tag.value }
  },
  component: () => <Outlet />,
})
