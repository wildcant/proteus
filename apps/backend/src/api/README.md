# API Route Conventions

File-based routing with `[id]` params. Each domain folder contains a `route.ts` for the collection and `[id]/route.ts` for individual resources.

## File Structure

```
src/api/
├── admin/
│   └── <domain>/
│       ├── route.ts           # GET (list), POST (create)
│       ├── [id]/
│       │   └── route.ts       # GET (retrieve), PATCH/POST (update), DELETE
│       └── definitions.ts    # Route definitions (handler, auth, schemas, OpenAPI metadata)
└── store/
    └── <domain>/              # Same structure
```

## What May Live Here

`src/api/` holds exactly four kinds of file:

| File | Holds |
|------|-------|
| `route.ts` | Handlers, plus their `Input`/`Output` constants |
| `definitions.ts` | The `RouteDefinition[]` that wires handlers to schemas, auth and OpenAPI |
| `middlewares.ts` | `MiddlewareFunction` factories, wired through a definition's `middlewares: [...]` |
| `__tests__/` | Integration tests |

A fifth kind is invisible to the routing layer — route discovery reads `definitions.ts` — so it
becomes a private convention nobody else follows. Where a Route Helper Goes, below, says where that
logic belongs instead.

Enforced by `api-holds-only-four-file-kinds` in `deps-analyzer/.dependency-cruiser.cjs`. Nested
sub-resources are fine at any depth (`payment-collections/[id]/payment-sessions/route.ts`); only the
filename is constrained. `src/api/index.ts` is exempt as the backend-as-library composition root.

## Where a Route Helper Goes

The rule the four file kinds imply: a handler calls out, it does not carry its own helpers. A
function defined beside a handler in `route.ts` is invisible to everything else — the next route
that needs it writes its own copy, and the handler it was meant to shorten can no longer be read
without also reading the helpers above and below it.

Two questions place the helper. Does it take `req`? Does it call a service?

| | **Calls no service** | **Calls a service** |
|---|---|---|
| **Takes no `req`** | Pure function in `src/workflows/<domain>/utils/` | A method on that module's service, or a workflow if it spans modules |
| **Takes `req`** | Inline it — it is a guard clause | Inline it too, unless a second route needs it — then a middleware in `middlewares.ts` |

### Pure → a util

It qualifies only if it names no service, no `container` and no `req`, and awaits nothing. Pass the
narrowed value rather than the request: a helper reading `req.body.data` is request-shaped, one
taking `data` is pure. File it under the domain whose data it shapes, not the route that happens to
call it — `build-starting-prices.ts` sits in `workflows/product/utils/` and is called from a route
handler and a workflow step alike.

### Several steps that must unwind together → a workflow

The signal is rollback, not length. Two mutations where a failure in the second has to undo the
first, or a sequence crossing module boundaries: that is a workflow. One read and one write is not a
complex handler, it is a handler. Wrapping a single service call in `createWorkflow` buys no
compensation and costs a file. See `src/workflows/README.md`.

### Fetch or validation reused by several routes → a middleware

Reuse is the gate, not shape. A fetch or a refusal that only one route makes stays inline at the top
of that handler, however middleware-shaped it looks: a `middlewares.ts` export wired into a single
definition splits one flow across two files and buys nothing back. It earns the move when a second
route needs the same thing — then it is a middleware of one of two kinds, guarding the request by
throwing (`validateAddressOwnership` in `store/customers/middlewares.ts`) or enriching it by putting
a value on `req` for the handler to narrow (`attachCustomer` in `store/middlewares.ts`).

Middlewares run before `input` is validated, so path params and body are still unvalidated inside
one — a guard that needs the parsed body cannot be one, no matter how many routes want it.

### Several calls chained on one service → a method on that service

A helper that resolves one module's service and then chains two or more of its methods — or whose
read decides its own write — is describing that module's behaviour in the route file. Move it behind
a single method and let the route ask for what it wants. This is not a workflow: workflows exist to
cross modules, and a module sequencing its own calls is just a method. If that method grows, the
module splits internally behind a private collaborator (`ProductOptionService` inside `product`) and
its public surface stays one service.

A helper can straddle two boxes — pure shaping wrapped around a service call, or a `req` read
wrapped around one. Split it rather than pick a winner: each half moves to the box it lands in on
its own.

## Route Handler Pattern

Export named HTTP methods (`GET`, `POST`, `PATCH`, `DELETE`). Each handler co-exports its `Input` and `Output` constants so the definition file can reference them. Each handler:
1. Co-exports an `Input` constant (`{ params?, body?, query? }`) and an `Output` schema
2. Uses `HttpRequest<typeof Input>` and `Promise<HttpResult<typeof Output>>` for type safety
3. Resolves services from `req.scope` (Awilix scoped container)

```ts
import { AdminCreateCustomers, AdminCreateCustomersResponse } from '@proteus/http-schemas/admin'
import type { HttpRequest, HttpResult } from '../../../server/ports.js'

export const PostInput = { body: AdminCreateCustomers }
export const PostOutput = AdminCreateCustomersResponse

export const POST = async (req: HttpRequest<typeof PostInput>): Promise<HttpResult<typeof PostOutput>> => {
  const customerService = req.scope.resolve<ICustomerModuleService>(Modules.CUSTOMER)
  const customers = await customerService.createCustomers(req.body)
  return { status: 201, json: { customers } }
}
```

### Middleware-provided context

A route co-exports its middleware list next to its `Input`/`Output`, and derives the handler's
request type from it. `HttpRequest`'s second parameter turns that list into whatever the
middlewares put on the request, so the handler reads `req.customer` without narrowing:

```ts
export const GetMiddlewares = [requireCustomer()] as const
export const GetOutput = StoreSavedMethodListResponse

export const GET = async (req: HttpRequest<object, typeof GetMiddlewares>) => {
  const { customer } = req // CustomerDTO — requireCustomer() refuses the request without one
}
```

The definition then forwards that same const — `middlewares: methodRoutes.GetMiddlewares` — next to
the `input` and `output` it already forwards. Deriving beats asserting: swap `requireCustomer()` for
the lenient `attachCustomer()` and every unguarded `req.customer` read stops compiling.

**`as const` is required.** Without it TypeScript widens a mixed list to its common element type —
`[validateScopeProviderAssociation(), validateToken()]` becomes `MiddlewareFunction<object>[]` — and
silently discards what each middleware adds. Single-element lists happen to survive; do not rely on
it.

A middleware declares what it adds through `MiddlewareFunction<Adds>`, which is enforced in both
directions — the return type makes the middleware prove it sets the field, and the phantom `adds` is
what a route recovers the type from. Which middlewares carry context today:

| Middleware | Adds |
|------------|------|
| `requireCustomer()` | `customer: CustomerDTO` — 401s a caller without one |
| `attachCustomer()` | `customer?: CustomerDTO` — for `auth: 'optional'` routes |
| `setPricingContext()` | `pricingContext: { currencyCode }` |
| `validateToken()` | `authContext: AuthContext` |
| `validateAddressOwnership()`, `validateScopeProviderAssociation()` | nothing — pure guards |

`authenticate()` stays context-free: whether it sets `authContext` depends on its runtime
`allowUnauthenticated` option, so the type cannot promise it.

## Response Type Rules

- **Never use `HttpResult<any>`** — always provide a typed response from `@proteus/http-schemas`
- **DELETE endpoints** use the shared `DeleteResponse` (returns `{ id, deleted: true }`)
- **Webhook endpoints** use `WebhookReceivedResponse` (returns `{ received: true }`)
- **Batch create** — if the payload is an array, return an array (e.g. `{ customers: [...] }`)

## Status Codes

| Operation | Status |
|-----------|--------|
| GET       | 200    |
| POST create | 201  |
| PATCH/POST update | 200 |
| DELETE    | 200    |

## Definition File

Each domain has a `definitions.ts` that default-exports a `RouteDefinition[]` array. Each definition wires a handler to its `input`/`output` schemas (co-exported from the route file), auth policy, and OpenAPI metadata:

```ts
import type { RouteDefinition } from '@framework/http/types.js'
import { Tags } from '@framework/http/types.js'
import * as customerRoutes from './route.js'
import * as customerByIdRoutes from './[id]/route.js'

export default [
  {
    method: 'POST',
    matcher: '/admin/customers',
    handler: customerRoutes.POST,
    input: customerRoutes.PostInput,
    operationId: 'createCustomers',
    summary: 'Create customers',
    tags: [Tags.CUSTOMERS],
    output: customerRoutes.PostOutput,
  },
  {
    method: 'DELETE',
    matcher: '/admin/customers/:id',
    handler: customerByIdRoutes.DELETE,
    input: customerByIdRoutes.DeleteInput,
    operationId: 'deleteCustomer',
    summary: 'Delete a customer',
    tags: [Tags.CUSTOMERS],
    output: customerByIdRoutes.DeleteOutput,
  },
] satisfies RouteDefinition[]
```

### Auth Policy

Admin and store routes default to `auth: 'required'`. Override with:
- `auth: 'public'` — no auth (e.g. store product browsing)
- `auth: 'optional'` — guests proceed, authenticated users get context
- `auth: 'unregistered'` — valid JWT required, actor record not required

Routes outside `/admin/` and `/store/` (e.g. `/auth/`, `/hooks/`) use explicit `middlewares` for auth.

## Checklist for Adding a New Endpoint

1. Define entity, payload, query, and response schemas in `packages/http-schemas/src/<scope>/<domain>/`
2. Create `route.ts` with typed handler(s)
3. Create or update `definitions.ts` with route definitions (handler, schemas, OpenAPI metadata)
4. Add the definition import to `src/routes.ts`
5. Run `npm run --workspace=backend typecheck` — zero errors
6. Run `npm run openapi:generate` to regenerate OpenAPI specs and clients
