import { createFileRoute, Outlet } from '@tanstack/react-router'
import { marketHeadLinksFor } from '#/lib/seo/market-links'

export const Route = createFileRoute('/_main/products')({
  ssr: true,
  head: (context) => ({ links: marketHeadLinksFor(context) }),
  component: () => <Outlet />,
})
