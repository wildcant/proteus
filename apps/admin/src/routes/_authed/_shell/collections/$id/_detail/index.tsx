import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/_authed/_shell/collections/$id/_detail/')({
  component: () => null,
})
