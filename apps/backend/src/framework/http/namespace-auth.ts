import type { ActorType } from '@proteus/http-schemas/auth'
import { authenticate } from './middlewares/authenticate.js'
import { resolveAuthorizationActor } from './middlewares/authorization-actor.js'
import { authorize } from './middlewares/authorize.js'
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
 *
 * When `permissions` is declared, authorization middlewares are appended:
 * auth → authorization-actor → authorize → handler
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

  const middlewares: MiddlewareFunction[] = [authMiddleware]

  if (definition.permissions && definition.permissions.length > 0) {
    middlewares.push(resolveAuthorizationActor())
    middlewares.push(authorize(definition.permissions, definition.matcher, definition.method))
  }

  definition.middlewares = [...middlewares, ...(definition.middlewares ?? [])]
}
