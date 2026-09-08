import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/_authed/settings/regions/$id/_detail/')({
  component: () => null,
})
