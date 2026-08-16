import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/_authed/_shell/products/$id/_detail/')({
  component: () => null,
})
