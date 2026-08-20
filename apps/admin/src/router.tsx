import { createRouter as createTanStackRouter } from '@tanstack/react-router'
import { queryClient } from './lib/query-client'
import { routeTree } from './routeTree.gen'

export function getRouter() {
  const router = createTanStackRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    defaultPreload: 'intent',
    defaultPreloadStaleTime: 0,
  })

  return router
}

declare module '@tanstack/react-router' {
  // biome-ignore lint/style/useConsistentTypeDefinitions: declaration merging requires interface
  interface Register {
    router: ReturnType<typeof getRouter>
  }
}
