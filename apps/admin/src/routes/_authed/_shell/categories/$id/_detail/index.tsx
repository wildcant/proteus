import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/_authed/_shell/categories/$id/_detail/')({
  component: () => null,
})
