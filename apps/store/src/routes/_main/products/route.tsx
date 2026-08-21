import { createFileRoute, Outlet } from '@tanstack/react-router'

export const Route = createFileRoute('/_main/products')({
  ssr: true,
  component: () => <Outlet />,
})
