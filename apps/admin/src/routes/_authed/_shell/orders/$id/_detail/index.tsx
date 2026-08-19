import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/_authed/_shell/orders/$id/_detail/')({
  component: () => null,
})
