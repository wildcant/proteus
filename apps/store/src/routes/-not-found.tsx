import { NotFound } from '#/components/store/not-found/not-found'
import { flowLinks } from '#/navigation/links'

/**
 * The router's `defaultNotFoundComponent`, here rather than in `router.tsx` because only a route may ask the flow map
 * for links. Not a route: the `-` prefix keeps it out of the route tree.
 */
export function RootNotFound() {
  return <NotFound homeLink={flowLinks('NotFound').HOME()} />
}
