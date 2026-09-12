# Routes

An endpoint is two files written in one sitting: the `route.ts` holding the handler and its
schema constants, and the `definitions.ts` that wires them to auth, a matcher and the OpenAPI
document. This covers both.

What a handler may *not* carry is next door in
[route helpers](./route-helpers.md). The generator that turns a definition into a spec entry, and
the `typeToStatus` map behind the error contract, are in
[`docs/middleware-and-openapi.md`](../../../../../docs/middleware-and-openapi.md).

## Structure

File-based routing with `[id]` params. Each domain folder holds a `route.ts` for the collection and
`[id]/route.ts` for the individual resource, and one `definitions.ts` for the whole domain.

```
src/api/
├── admin/
│   └── <domain>/
│       ├── route.ts           # GET (list), POST (create)
│       ├── [id]/
│       │   └── route.ts       # GET (retrieve), PATCH/POST (update), DELETE
│       └── definitions.ts     # handler, auth, schemas, OpenAPI metadata
└── store/
    └── <domain>/              # same structure
```

`src/api/` holds exactly four kinds of file, and that list is closed:

| File | Holds |
|------|-------|
| `route.ts` | Handlers, plus their `Input` / `Output` / `Throws` / `Middlewares` constants |
| `definitions.ts` | The `RouteDefinition[]` that wires handlers to schemas, auth and OpenAPI |
| `middlewares.ts` | `MiddlewareFunction` factories, wired through a definition's `middlewares: [...]` |
| `__tests__/` | Integration tests |

A fifth kind is invisible to the routing layer — route discovery reads `definitions.ts` — so it
becomes a private convention nobody else follows. [Route helpers](./route-helpers.md) says where
that logic belongs instead.

Enforced by `api-holds-only-four-file-kinds` in `structure/.dependency-cruiser.cjs`. Nested
sub-resources are fine at any depth (`payment-collections/[id]/payment-sessions/route.ts`); only the
filename is constrained.

## Shape

```ts
import { AdminCreateCustomers, AdminCreateCustomersResponse } from '@proteus/http-schemas/admin'
import type { HttpRequest, HttpResult } from '@framework/http/ports.js'

export const PostInput = { body: AdminCreateCustomers }
export const PostOutput = AdminCreateCustomersResponse

export const POST = async (req: HttpRequest<typeof PostInput>): Promise<HttpResult<typeof PostOutput>> => {
  const customerService = req.scope.resolve<ICustomerModuleService>(Modules.CUSTOMER)
  const customers = await customerService.createCustomers(req.body)
  return { status: 201, json: { customers } }
}
```

```ts
// definitions.ts — one array for the whole domain
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
] satisfies RouteDefinition[]
```

## Rules

### A handler co-exports its own contract

Export named HTTP methods — `GET`, `POST`, `PATCH`, `DELETE` — as `const` arrow functions. Beside
each one goes the constants the definition forwards: an `Input` (`{ params?, body?, query? }`), an
`Output` schema, a `Throws` when the handler can fail on its own terms, and a `Middlewares` list when
it has one. Type the handler as `HttpRequest<typeof Input>` and
`Promise<HttpResult<typeof Output>>`, and resolve services from `req.scope`.

The definition then forwards each export by name — `input: customerRoutes.PostInput`,
`output: customerRoutes.PostOutput`, `throws: cartRoutes.PostThrows` — so the two files say the same
thing without either restating it. Never `HttpResult<any>`: the response type always comes from
`@proteus/http-schemas`.

### The failure half is `Throws`

`Output` is the success half of a route's contract and `Throws` is the failure half — a list of
`ErrorTypes` that `registerOpenApiRoute` turns into declared responses through the same map the
error handler answers with, so the spec cannot promise a status the API does not send. The example
above has none, and correctly: it raises nothing itself.

Two ways a type gets on the list, and the difference matters.

```ts
// Raised by this handler → named here
export const PostThrows = [ErrorTypes.CONFLICT] as const

// Raised inside a workflow this handler runs → spread, never restated
export const PostThrows = [...completeCartWorkflow.throws, ErrorTypes.CONFLICT] as const
```

Spreading is what carries a failure raised several step-frames down into the OpenAPI document
without anything in between restating it. Structural failures stay off the list entirely — the 400
from schema validation and the 401 from an auth middleware are derived from the definition itself.

The list is checked in both directions and at the workflow boundary, so a wrong one fails
`pnpm run verify` rather than shipping a lying spec.

### A middleware's contribution is derived, not asserted

A route co-exports its middleware list next to its `Input` / `Output`, and derives the handler's
request type from it. `HttpRequest`'s second parameter turns that list into whatever the middlewares
put on the request, so the handler reads `req.customer` without narrowing:

```ts
export const GetMiddlewares = [requireCustomer()] as const
export const GetOutput = StoreSavedMethodListResponse

export const GET = async (req: HttpRequest<object, typeof GetMiddlewares>) => {
  const { customer } = req // CustomerDTO — requireCustomer() refuses the request without one
}
```

The definition forwards that same const — `middlewares: methodRoutes.GetMiddlewares` — beside the
`input` and `output` it already forwards. Deriving beats asserting: swap `requireCustomer()` for the
lenient `attachCustomer()` and every unguarded `req.customer` read stops compiling.

**`as const` is required.** Without it TypeScript widens a mixed list to its common element type —
`[validateScopeProviderAssociation(), validateToken()]` becomes `MiddlewareFunction<object>[]` — and
silently discards what each middleware adds. Single-element lists happen to survive; do not rely on
it.

A middleware declares what it adds through `MiddlewareFunction<Adds>`, enforced in both directions:
the return type makes the middleware prove it sets the field, and the phantom `adds` is what a route
recovers the type from. Which middlewares carry context today:

| Middleware | Adds |
|------------|------|
| `requireCustomer()` | `customer: CustomerDTO` — 401s a caller without one |
| `attachCustomer()` | `customer?: CustomerDTO` — for `auth: 'optional'` routes |
| `setPricingContext()` | `pricingContext: { currencyCode }` |
| `validateToken()` | `authContext: AuthContext` |
| `validateAddressOwnership()`, `validateScopeProviderAssociation()` | nothing — pure guards |

`authenticate()` stays context-free: whether it sets `authContext` depends on its runtime
`allowUnauthenticated` option, so the type cannot promise it.

### Query params a middleware reads are declared as `contextQuery`

`setPricingContext()` parses `req.query` itself, before `applyMiddleware` validates anything, so the
params it reads appear nowhere unless the route says so. `contextQuery` is that declaration — it has
no runtime effect, and exists to put `countryCode` and `cartId` into the OpenAPI document and the
generated client:

```ts
export const PostInput = { body: StoreCreateCart, contextQuery: StorePricingContextParams }
export const PostMiddlewares = [setPricingContext()] as const
```

The two travel together. Declaring one without the other either documents params nothing reads or
reads params nothing documents, and both are checked. A second context middleware brings its own
pair of rules rather than widening these.

### Responses and statuses are uniform

- **DELETE** answers with the shared `DeleteResponse` — `{ id, deleted: true }`. A per-resource
  variant becomes its own schema in the spec and its own generated model, so a client that handles
  deletions could not handle them uniformly.
- **Webhooks** answer with `WebhookReceivedResponse` — `{ received: true }`.
- **Batch create** returns what it was given the shape of: an array payload answers with an array.

| Operation | Status |
|-----------|--------|
| GET | 200 |
| POST create | 201 |
| PATCH/POST update | 200 |
| DELETE | 200 |

### Auth is a namespace default the definition overrides

Admin and store routes default to `auth: 'required'`. Override with `auth: 'public'` (store product
browsing), `auth: 'optional'` (guests proceed, authenticated users get context) or
`auth: 'unregistered'` (valid JWT required, actor record not). Routes outside `/admin/` and `/store/`
— `/auth/` — use explicit `middlewares` for auth, because there is no namespace default to override.

**Webhooks are the exception with no `auth` and no `middlewares`.** A gateway does not hold a
credential; it signs the request, and the signature is verified over the raw bytes by the provider
adapter inside the handler — `/hooks/payment/:provider` reaches it through
`getWebhookActionAndData`. A middleware could not do that job even if one were written: middlewares
run before `input` is validated, and verification needs both the raw body and the provider named in
the path. So an empty definition here is the authenticated case, not an unguarded one — and a
handler on `/hooks/` that verifies nothing is the bug this paragraph exists to make visible.

## Enforcement

| Rule id | The paragraph it enforces |
|---|---|
| `route-throws-undeclared-error` | a type the handler raises is on the method's `Throws` list |
| `route-declares-unthrown-error` | a type on the list is one the file actually raises |
| `route-omits-workflow-errors` | a `.run()` spreads the callee's `.throws` rather than restating it |
| `route-omits-context-query` | a route running `setPricingContext()` declares `contextQuery` |
| `route-declares-unread-context-query` | a route declaring `contextQuery` runs the middleware that reads it |
| `delete-route-returns-shared-response` | a DELETE answers with the shared `DeleteResponse` |
| `webhook-route-returns-shared-response` | a webhook answers with the shared `WebhookReceivedResponse` |
| `route-returns-non-200-status` | a GET, PATCH or DELETE answers 200 |
| `route-method-without-output` | a handler co-exports the `Output` its definition forwards |
| `route-list-without-as-const` | a `Throws` or `Middlewares` list carries `as const` |

`route-omits-workflow-errors` sits at `standards/rules/backend/` rather than in this directory,
because its claim spans both sides of the call: its `files:` glob covers `route.ts` *and*
`src/workflows/`. The route half is the paragraph above; the workflow half is in
[workflows](../../workflows/__docs__/workflows.md#relationship-with-routes).

`standards/README.md` covers how rules run, how their tests work, and how to suppress one.

### Exemptions

`route-declares-unthrown-error` and `workflow-declares-unthrown-error` are the two that get
suppressed rather than fixed, and always for one reason: the throw belongs to a module service the
handler calls, not to the handler itself, so the route is right to declare a status ast-grep cannot
see it raise. Write the reason above the suppression.

## What is deliberately not enforced

- **That the `Throws` list matches the *method* that raises.** Nothing correlates `PostThrows` with
  the `POST` handler for ast-grep, so both error rules are scoped to the file: a type declared on one
  method satisfies a throw in another. This is the same narrowing `replay-purity.ts` takes, and the
  OpenAPI diff catches what it lets through.
- **That a POST or PUT answers the right status.** `route-returns-non-200-status` speaks for the
  three methods that have one answer and stops there. Create and update are the same syntax, so only
  the service call underneath says which a POST is, and PUT is that argument again with two sites.
  Worth knowing: `registerOpenApiRoute` declares 200 for every route regardless, so the 201s here are
  undocumented in the spec.
- **That the response type is never `HttpResult<any>`.** Already enforced, elsewhere: Biome's
  `suspicious/noExplicitAny` is on through `preset: recommended` and fails the `lint` gate. A rule
  repeating it here would be a second place to keep in step, for a claim that is not about routes.
- **That a webhook verifies its signature.** The verification happens inside a provider adapter the
  route reaches through the payment service, several frames from anything a rule can see in
  `route.ts`.
- **That `route.ts` and `definitions.ts` agree.** The definition forwards constants by name, so a
  forgotten `throws:` or a `middlewares:` wired to the wrong method is a plain omission rather than a
  shape. A rule matching one file cannot see the other; typecheck catches a misspelt export and the
  OpenAPI diff catches a stale one, and what falls between the two is unchecked today.

## Relationship with route helpers

Everything above is what a route file *must* hold. What it must not hold — the helper a handler
grows when the work gets long — is [route helpers](./route-helpers.md), and the two rules there are
the ones that fire most often.

## Checklist for adding an endpoint

1. Define entity, payload, query and response schemas in `packages/http-schemas/src/<scope>/<domain>/`
2. Create `route.ts` with typed handler(s), co-exporting `Input` / `Output` and a `Throws` for
   whatever the handler itself can raise
3. Create or update `definitions.ts` with the definition — handler, schemas, `throws`, OpenAPI metadata
4. Add the definition import to `src/routes.ts`
5. `pnpm --filter backend run typecheck` — zero errors
6. `pnpm run openapi:generate` to regenerate the specs and clients
7. `pnpm run verify` — the rules above check the `Throws` list against the handler in both directions
