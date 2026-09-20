import type { ActorType } from '@proteus/http-schemas/auth'
import { authenticate } from './middlewares/authenticate.js'
import type { MiddlewareFunction, RouteDefinition } from './types.js'

function getNamespaceActorType(routePath: string): ActorType | undefined {
  if (routePath.startsWith('/admin/')) return 'user'
  if (routePath.startsWith('/store/')) return 'customer'
  return undefined
}

/**
 * Inject namespace-appropriate auth middleware based on the route's `auth` policy.
 *
 * - `'required'` (default) — strict auth for the namespace actor type
 * - `'optional'` — guests proceed, authenticated users get context
 * - `'unregistered'` — valid JWT required, actor record not required
 * - `'public'` — no auth middleware injected
 *
 * Routes outside `/admin/` and `/store/` namespaces are unaffected.
 */
export function applyNamespaceAuth(definition: RouteDefinition): void {
  const auth = definition.auth ?? 'required'

  if (auth === 'public') return

  const actorType = getNamespaceActorType(definition.matcher)
  if (!actorType) return

  const options =
    auth === 'optional'
      ? { allowUnauthenticated: true }
      : auth === 'unregistered'
        ? { allowUnregistered: true }
        : undefined

  const authMiddleware: MiddlewareFunction = authenticate(actorType, options)

  definition.middlewares = [authMiddleware, ...(definition.middlewares ?? [])]
}
