# Plan: Route Definition & Registration Overhaul

## Problem

The current middleware system has two bugs:

1. **All-or-nothing auth** — Setting ANY `middlewares` on a route config causes namespace auth to be skipped entirely (`namespace-auth.ts:14: if (config.middlewares) return`). Routes opt out of auth via a `middlewares: []` hack. You can't have custom middlewares AND auth.

2. **Silent unregistered routes** — Two loaders (`routes-loader.ts` for Node, `routes-static.ts` for Workers) with duplicated logic. Routes without a matching middleware config get no auth, no validation, no OpenAPI docs — silently.

## Design Decisions

| Decision | Answer | Rationale |
|---|---|---|
| Type name | `RouteDefinition` | It defines routes, not middleware. Holds handler, schemas, auth, OpenAPI metadata, and middleware. |
| File name | `definitions.ts` | Mirrors the type name. Clear distinction from `route.ts` (handler). |
| Auth model | `auth?: AuthPolicy` (4-value enum) | Declarative auth for namespaced routes. Eliminates `authenticate()` in `middlewares` for admin/store. |
| Handler in definition | `handler: RouteHandler` | Definition imports handler from `route.ts`. Eliminates matcher-based matching between separate files. |
| Single loader | Static registration only | One code path for Node and Workers. Explicit imports, no filesystem scanning. |
| Pattern | Plain array with `satisfies RouteDefinition[]` | Type-checked, no callback wrapper needed. |
| File structure | One `definitions.ts` per resource directory | Matches current layout. Groups related routes (e.g., list + create + get + update + delete). |

## Type Definitions

### AuthPolicy

```ts
type AuthPolicy = 'required' | 'optional' | 'unregistered' | 'public'
```

| Value | Behavior | Use case |
|---|---|---|
| `'required'` | `authenticate(actorType)` | Default for admin/store. Strict auth. |
| `'optional'` | `authenticate(actorType, { allowUnauthenticated: true })` | Store product browsing. Guests proceed, customers get context. |
| `'unregistered'` | `authenticate(actorType, { allowUnregistered: true })` | Invite acceptance. Valid JWT required, actor record not required. |
| `'public'` | No auth middleware injected | Webhooks, feature flags. Fully public. |

Default: `'required'`. Only exceptions need to spell it out.

Namespace determines actor type:
- `/admin/*` -> `'user'`
- `/store/*` -> `'customer'`
- `/auth/*`, `/hooks/*` -> no namespace auth (routes use explicit `authenticate()` in `middlewares`)

### RouteDefinition

```ts
type BaseRoute = {
  auth?: AuthPolicy
  description?: string
  handler: RouteHandler
  matcher: string
  middlewares?: MiddlewareFunction[]
  operationId: string
  paramsSchema?: z.ZodType
  responseSchema: z.ZodType
  summary?: string
  tags: Tag[]
}

type GetRoute = BaseRoute & {
  method: 'GET'
  querySchema?: z.ZodType
  searchableColumns?: string[]
}

type BodyRoute = BaseRoute & {
  method: 'POST' | 'PUT' | 'PATCH'
  bodySchema?: z.ZodType
}

type DeleteRoute = BaseRoute & {
  method: 'DELETE'
}

export type RouteDefinition = GetRoute | BodyRoute | DeleteRoute
```

## What a definitions.ts file looks like

### Admin route (auth is implicit — defaults to `'required'`)

```ts
// api/admin/customers/definitions.ts
import * as customerRoutes from './route.js'
import * as customerByIdRoutes from './[id]/route.js'

export default [
  {
    method: 'GET',
    matcher: '/admin/customers',
    handler: customerRoutes.GET,
    querySchema: AdminCustomerListParams,
    operationId: 'listCustomers',
    summary: 'List customers',
    tags: [Tags.CUSTOMERS],
    responseSchema: AdminCustomerListResponse,
  },
  {
    method: 'GET',
    matcher: '/admin/customers/:id',
    handler: customerByIdRoutes.GET,
    paramsSchema: IdParams,
    operationId: 'getCustomer',
    summary: 'Retrieve a customer',
    tags: [Tags.CUSTOMERS],
    responseSchema: AdminCustomerResponse,
  },
  // ...
] satisfies RouteDefinition[]
```

### Store route with public auth

```ts
// api/store/products/definitions.ts
import * as productRoutes from './route.js'
import * as productByIdRoutes from './[id]/route.js'

export default [
  {
    method: 'GET',
    matcher: '/store/products',
    auth: 'public',
    handler: productRoutes.GET,
    querySchema: StoreProductListParams,
    searchableColumns: searchable<ProductDTO>('title'),
    operationId: 'listStoreProducts',
    summary: 'List published products',
    tags: [Tags.PRODUCTS],
    responseSchema: StoreProductListResponse,
  },
  // ...
] satisfies RouteDefinition[]
```

### Auth route with explicit authenticate middleware

```ts
// api/auth/definitions.ts
import { authenticate } from '@core/auth/middleware/authenticate.js'
import * as tokenRefreshRoutes from './token/refresh/route.js'

export default [
  {
    method: 'POST',
    matcher: '/auth/token/refresh',
    middlewares: [authenticate('*', { allowUnregistered: true })],
    handler: tokenRefreshRoutes.POST,
    operationId: 'authTokenRefresh',
    summary: 'Refresh an auth token',
    tags: [Tags.AUTH],
    responseSchema: AuthenticateResponse,
  },
  // ...
] satisfies RouteDefinition[]
```

## Implementation Steps

### Step 1: Update types

**File: `src/core/middleware/types.ts`**

- Rename `MiddlewareRoute` to `RouteDefinition`
- Add `AuthPolicy` type
- Add `auth?: AuthPolicy` to `BaseRoute`
- Add `handler: RouteHandler` to `BaseRoute`

### Step 2: Rewrite `applyNamespaceAuth`

**File: `src/core/middleware/namespace-auth.ts`**

```ts
import type { ActorType } from '@proteus/http-schemas/auth'
import { authenticate } from '../auth/middleware/authenticate.js'
import type { MiddlewareFunction, RouteDefinition } from './types.js'

function getNamespaceActorType(routePath: string): ActorType | undefined {
  if (routePath.startsWith('/admin/')) return 'user'
  if (routePath.startsWith('/store/')) return 'customer'
  return undefined
}

export function applyNamespaceAuth(definition: RouteDefinition): void {
  const auth = definition.auth ?? 'required'

  if (auth === 'public') return

  const actorType = getNamespaceActorType(definition.matcher)
  if (!actorType) return

  const options =
    auth === 'optional' ? { allowUnauthenticated: true }
    : auth === 'unregistered' ? { allowUnregistered: true }
    : undefined

  const authMiddleware = authenticate(actorType, options)

  definition.middlewares = [authMiddleware, ...(definition.middlewares ?? [])]
}
```

### Step 3: Update `applyMiddleware`

**File: `src/core/middleware/apply-middleware.ts`**

Handler comes from the definition instead of a separate argument:

```ts
export function applyMiddleware(definition: RouteDefinition): RouteHandler {
  return (async (req) => {
    if (definition.middlewares) req = await runMiddlewares(definition.middlewares, req)

    // ... params/query/body validation (unchanged logic) ...

    const result = await definition.handler(req)
    return { ...result, json: definition.responseSchema.parse(result.json) }
  }) as RouteHandler
}
```

### Step 4: Rename `middlewares.ts` -> `definitions.ts` across all resources

For each resource directory:
1. Rename the file
2. Import handlers from `route.ts` (using `import * as` for namespace imports)
3. Add `handler` field to each definition
4. Replace `middlewares: []` with `auth: 'public'` (store products)
5. Change `satisfies MiddlewareRoute[]` to `satisfies RouteDefinition[]`

**Files to rename:**

| From | To |
|---|---|
| `src/api/admin/customers/middlewares.ts` | `src/api/admin/customers/definitions.ts` |
| `src/api/admin/fulfillment-providers/middlewares.ts` | `src/api/admin/fulfillment-providers/definitions.ts` |
| `src/api/admin/fulfillment-sets/middlewares.ts` | `src/api/admin/fulfillment-sets/definitions.ts` |
| `src/api/admin/payment-collections/middlewares.ts` | `src/api/admin/payment-collections/definitions.ts` |
| `src/api/admin/payments/middlewares.ts` | `src/api/admin/payments/definitions.ts` |
| `src/api/admin/products/middlewares.ts` | `src/api/admin/products/definitions.ts` |
| `src/api/admin/refund-reasons/middlewares.ts` | `src/api/admin/refund-reasons/definitions.ts` |
| `src/api/admin/shipping-options/middlewares.ts` | `src/api/admin/shipping-options/definitions.ts` |
| `src/api/admin/shipping-profiles/middlewares.ts` | `src/api/admin/shipping-profiles/definitions.ts` |
| `src/api/admin/users/middlewares.ts` | `src/api/admin/users/definitions.ts` |
| `src/api/auth/middlewares.ts` | `src/api/auth/definitions.ts` |
| `src/api/hooks/middlewares.ts` | `src/api/hooks/definitions.ts` |
| `src/api/store/carts/middlewares.ts` | `src/api/store/carts/definitions.ts` |
| `src/api/store/payment-collections/middlewares.ts` | `src/api/store/payment-collections/definitions.ts` |
| `src/api/store/payment-providers/middlewares.ts` | `src/api/store/payment-providers/definitions.ts` |
| `src/api/store/products/middlewares.ts` | `src/api/store/products/definitions.ts` |

### Step 5: Rewrite route registration (single static loader)

**File: `src/routes.ts`** (replaces both `routes-loader.ts` and `routes-static.ts`)

```ts
import { applyMiddleware } from './core/middleware/apply-middleware.js'
import { applyNamespaceAuth } from './core/middleware/namespace-auth.js'
import type { RouteDefinition } from './core/middleware/types.js'
import { registerOpenApiRoutes } from './core/openapi/register-route.js'
import type { Logger } from './core/types/logger.js'
import type { App } from './server/ports.js'
import { RoutesSorter } from './server/routes-sorter.js'

// ---- Definition imports ----
import adminCustomerDefs from './api/admin/customers/definitions.js'
import adminPaymentCollectionDefs from './api/admin/payment-collections/definitions.js'
// ... all other definition imports ...

// ---- Registration ----
const allDefinitions: RouteDefinition[] = [
  ...adminCustomerDefs,
  ...adminPaymentCollectionDefs,
  // ... spread all definitions ...
]

export function registerRoutes(app: App, logger: Logger, resolveRegistry?: RegistryResolver) {
  // Apply namespace auth to all definitions
  for (const definition of allDefinitions) {
    applyNamespaceAuth(definition)
  }

  // Register OpenAPI docs
  if (resolveRegistry) {
    for (const definition of allDefinitions) {
      const registry = resolveRegistry(definition.matcher)
      if (registry) registerOpenApiRoute(registry, definition.matcher, definition)
    }
  }

  // Sort and register route handlers
  const sorted = new RoutesSorter(allDefinitions).sort()
  for (const definition of sorted) {
    const handler = applyMiddleware(definition)
    app.addRoute(definition.method, definition.matcher, handler)
    logger.info(`  ${definition.method} ${definition.matcher}`)
  }
}
```

### Step 6: Delete `routes-loader.ts`

**File: `src/routes-loader.ts`** -> DELETE

Filesystem scanning is no longer used. All registration is static.

### Step 7: Update callers of route registration

Update any files that import from `routes-loader.ts` or `routes-static.ts`:
- `src/server/platforms.ts` or wherever `loadRoutes` / `registerStaticRoutes` is called

Change to import `registerRoutes` from `src/routes.js`.

### Step 8: Build-time validation

Add a dev-time check (can be a test or a build script):

1. **Unregistered route files** — Glob for all `route.ts` files under `src/api/`. For each exported handler (GET, POST, etc.), verify a matching definition exists in `allDefinitions` (by matcher + method). Warn if a handler has no definition.

2. **Auth contradiction** — For definitions in admin/store namespaces, warn if `auth` is set AND `middlewares` contains an `authenticate()` call.

### Step 9: Write tests

**File: `src/core/middleware/__tests__/namespace-auth.test.ts`** (new)

Tests for `applyNamespaceAuth` with the 4-value enum:

1. Admin route, default (no `auth`) -> `authenticate('user')` prepended
2. Store route, default -> `authenticate('customer')` prepended
3. `auth: 'public'` -> no auth injected
4. `auth: 'optional'` -> `authenticate(actorType, { allowUnauthenticated: true })` prepended
5. `auth: 'unregistered'` -> `authenticate(actorType, { allowUnregistered: true })` prepended
6. `auth: 'required'` with custom middlewares -> auth prepended before custom middlewares
7. `/auth/` route -> no namespace auth regardless of `auth` value
8. `/hooks/` route -> no namespace auth

**File: `src/core/middleware/__tests__/apply-middleware.test.ts`** (new)

Tests for the middleware + validation pipeline:

1. Handler receives validated params/query/body
2. Response is validated through `responseSchema`
3. Middlewares run in order before handler
4. Auth middleware (from namespace) runs before custom middleware

### Step 10: Clean up Medusa reference files

**Delete entirely:**

| Directory/File | Reason |
|---|---|
| `src/framework/http/middlewares/` (all 12 files) | Express-specific, not reusable |
| `src/framework/http/__tests__/` (all test files) | Jest + Express + supertest |
| `src/framework/http/__fixtures__/` (all fixtures) | Medusa-specific test infrastructure |

Nothing from `src/framework/http/` is kept. The learnings have been incorporated into the design.

## File Changes Summary

| File | Action |
|---|---|
| `src/core/middleware/types.ts` | EDIT — rename type, add `AuthPolicy`, add `handler` |
| `src/core/middleware/namespace-auth.ts` | REWRITE — 4-value enum, compose middlewares |
| `src/core/middleware/apply-middleware.ts` | EDIT — handler from definition |
| `src/core/middleware/run-middlewares.ts` | NO CHANGE |
| `src/routes.ts` | CREATE — single static registration |
| `src/routes-loader.ts` | DELETE |
| `src/routes-static.ts` | DELETE (replaced by `src/routes.ts`) |
| `src/api/**/middlewares.ts` (16 files) | RENAME to `definitions.ts`, add handler imports |
| `src/core/middleware/__tests__/namespace-auth.test.ts` | CREATE |
| `src/core/middleware/__tests__/apply-middleware.test.ts` | CREATE |
| `src/core/openapi/register-route.ts` | EDIT — update type references |
| `src/server/platforms.ts` (or equivalent) | EDIT — update import |
| `src/api/index.ts` | EDIT — update import |
| `src/framework/http/middlewares/*.ts` (12 files) | DELETE |
| `src/framework/http/__tests__/*.spec.ts` | DELETE |
| `src/framework/http/__fixtures__/` | DELETE |
| `docs/middleware-overhaul-plan.md` | This file |

## Verification

1. All existing tests pass (`pnpm --filter backend run test`)
2. New `namespace-auth.test.ts` passes (8 tests)
3. New `apply-middleware.test.ts` passes
4. `pnpm run check` passes (linting)
5. `pnpm run typecheck` passes
6. `pnpm run openapi:generate` produces the same OpenAPI spec
7. Admin endpoints require auth (manual test or integration test)
8. Store product endpoints are public (manual test)
9. Auth endpoints work with explicit middleware (token refresh, verification)
