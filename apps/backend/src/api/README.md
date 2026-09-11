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

Enforced by `api-holds-only-four-file-kinds` in `structure/.dependency-cruiser.cjs`. Nested
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
| **Takes no `req`** | Pure function in `src/workflows/<domain>/utils/` | Reads only → inline it. Mutates → a transactional method on that module's service; a workflow only once the mutations cross modules |
| **Takes `req`** | Inline it — it is a guard clause | Inline it too, unless a second route needs it — then a middleware in `middlewares.ts` |

Note which question the top-right cell does *not* ask: how many services it touches. Crossing a
module boundary is not by itself a reason to leave the handler — mutating across one is.

### Pure → a util

It qualifies only if it names no service, no `container` and no `req`, and awaits nothing. Pass the
narrowed value rather than the request: a helper reading `req.body.data` is request-shaped, one
taking `data` is pure. File it under the domain whose data it shapes, not the route that happens to
call it — `build-starting-prices.ts` sits in `workflows/product/utils/` and is called from a route
handler and a workflow step alike.

### Several reads, even across modules → inline them

A read has nothing to unwind, so there is nothing for a workflow to compensate and no transaction to
hold it together. Two services queried in sequence to answer one question is a handler doing its job,
however many modules the answer touches: resolve both, read both, return. It stays inline no matter
how long the chain gets.

What a long read chain usually wants is a comment, not a file. `store/carts/[id]/shipping-options`
resolves the cart's country by falling back from the shipping address to the region the cart was
opened in — three reads across two modules, and the part worth extracting is the paragraph
explaining why the address wins, not the code.

The exception is the pure half. Once the reads are done, shaping the rows into the response is a
util (above) — `buildStartingPrices` takes variants, links and prices already fetched by the caller.
Extract the shaping, leave the fetching.

### Mutations that must not half-happen → one transaction, then a workflow

The goal is atomicity; a workflow is one way to buy it and not the cheap one. Take the first of these
that covers the case:

| The mutations | Use |
|---|---|
| One mutation | Just call the service |
| Several, all in one module | One method on that service, wrapped in `this.withTransaction` |
| Several, spanning modules | A workflow with `ctx.step()` compensation |

**Prefer the transaction wherever it reaches.** Postgres already unwinds a failed transaction, so a
single method gets atomicity with no compensation to write, none to keep correct as the action
changes, and no half-applied state to reason about — compensation is hand-written rollback that can
itself fail, and every step needs one.

Where it reaches is one module. The modules share a database, but a `Context` is only ever threaded
within a module's own service and repositories — nothing hands another module's service a
transaction to join, and a workflow step resolves each service independently. That is the boundary
compensation exists to cover, and the only one it has to.

Chaining a module's own methods inside one transaction is already the pattern:
`createWithTransaction` joins an existing `context.transaction` instead of opening a nested one
(`core/utils/with-transaction.ts`), so an outer method passes `ctx` down as each callee's `context`
and the whole sequence commits or rolls back once — see `upsertPriceSets` in
`pricing-module-service.ts`, which calls `createPriceSets` and `updatePriceSets` that way while both
stay independently callable. `capturePayment` (write the capture row, update the payment) and
`setDefaultAddress` (release the old flags, claim the new) are the two-mutation shape.

Workflows already draw the line this way from their own side: `add-to-cart` keeps the cart and its
line items in one step because they are "one module, so the cart module writes them in a single
transaction", and `set-product-options` does the same for options and the variant moves they force.
A workflow reaching for a step per mutation inside one module is buying compensation it could have
had for free.

So "these must not half-happen" is not on its own a workflow signal — ask which module they land in
first. Wrapping a single service call in `createWorkflow` buys no compensation and costs a file. See
`src/workflows/README.md`.

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

A route that resolves one module's service and then chains two or more of its methods — or whose read
decides its own write — is describing that module's behaviour in the route file. Move it behind a
single method and let the route ask for what it wants. This is not a workflow: workflows exist to
cross modules, and a module sequencing its own calls is just a method. If that method grows, the
module splits internally behind a private collaborator (`ProductOptionService` inside `product`) and
its public surface stays one service.

Two things follow from where the method now sits. It can wrap the sequence in one transaction, which
is why this is the answer to a multi-mutation route and not merely a tidier one — see above. And the
read that decided the write happens inside that transaction rather than before it, so the decision
cannot be made stale by a concurrent request between the two calls, which is a correctness gap the
route could not close from where it stood.

A helper can straddle two boxes — pure shaping wrapped around a service call, or a `req` read
wrapped around one. Split it rather than pick a winner: each half moves to the box it lands in on
its own.

### Enforcement

| Rule id | The paragraph it enforces |
|---|---|
| `route-declares-helper-function` | that a handler calls out rather than carrying its own helpers |
| `route-chains-mutations-on-one-service` | that two mutations on one module share a transaction behind one method |
| `delete-route-returns-shared-response` | that a DELETE answers with the shared `DeleteResponse` |

Both route-helper rules were written against the code that broke them, and both still flag it: the
country fallback that was a `function` in `shipping-options/route.ts`, and the create→authorize→
capture and delete→add sequences that are now `markPaymentCollectionAsPaid` and `setShippingMethod`.

#### What is deliberately not enforced

- **Which module a service belongs to.** `route-chains-mutations-on-one-service` keys on the
  variable name, so it sees one *service*, not one module. Two services resolved from the same
  module read as unrelated and go unreported. The rule errs this way on purpose: the opposite error
  flags a cross-module sequence, which is the case that legitimately is a workflow.
- **Whether a call mutates.** A prefix list stands in for that — `create`, `softDelete`, `capture`
  and the rest. A mutating method named outside it is invisible, and `ensure` is excluded by hand
  because `ensureAccountHolders` provisions at a gateway and cannot join a transaction anyway.
- **That a POST creating something answers 201.** Create and update are the same syntax; only the
  service call underneath says which this is. Worth knowing: `registerOpenApiRoute` declares 200 for
  every route regardless, so the 201s here are undocumented in the spec.
- **That a webhook verifies its signature.** The verification happens inside a provider adapter the
  route reaches through the payment service, several frames from anything a rule can see in
  `route.ts`.
- **That a read chain stays inline.** There is no shape to match — the compliant version is an
  absence. `route-declares-helper-function` catches the form it takes when someone extracts one.

## Route Handler Pattern

Export named HTTP methods (`GET`, `POST`, `PATCH`, `DELETE`). Each handler co-exports its `Input` and `Output` constants so the definition file can reference them. Each handler:
1. Co-exports an `Input` constant (`{ params?, body?, query? }`) and an `Output` schema
2. Uses `HttpRequest<typeof Input>` and `Promise<HttpResult<typeof Output>>` for type safety
3. Resolves services from `req.scope` (Awilix scoped container)
4. Co-exports a `Throws` constant when it can fail on its own terms — see below

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

### The failure half: `Throws`

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

Three rules in `standards/` keep this honest in both directions, so a wrong list fails `npm run verify`
rather than shipping a lying spec: `route-throws-undeclared-error` (handler raises a type the list
omits), `route-declares-unthrown-error` (list names a type nothing raises), and
`route-omits-workflow-errors` (a `.run()` whose caller does not spread the callee's `.throws`). Full
treatment, including how `typeToStatus` maps types to statuses: `docs/middleware-and-openapi.md`.

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

Each domain has a `definitions.ts` that default-exports a `RouteDefinition[]` array. Each definition wires a handler to its `input`/`output` schemas (co-exported from the route file), auth policy, and OpenAPI metadata. Neither route below can fail on its own terms, so neither declares `throws`; one that can forwards its export the same way as everything else — `throws: cartRoutes.PostThrows`, beside the `input` and `output` already forwarded:

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

Routes outside `/admin/` and `/store/` (e.g. `/auth/`) use explicit `middlewares` for auth, because
there is no namespace default to override.

**Webhooks are the exception with no `auth` and no `middlewares`.** A gateway does not hold a
credential; it signs the request, and the signature is verified over the raw bytes by the provider
adapter inside the handler — `/hooks/payment/:provider` reaches it through
`getWebhookActionAndData`. A middleware could not do that job even if one were written: middlewares
run before `input` is validated, and verification needs both the raw body and the provider named in
the path. So an empty definition here is the authenticated case, not an unguarded one — and a
handler on `/hooks/` that verifies nothing is the bug this paragraph exists to make visible.

## Checklist for Adding a New Endpoint

1. Define entity, payload, query, and response schemas in `packages/http-schemas/src/<scope>/<domain>/`
2. Create `route.ts` with typed handler(s), co-exporting `Input`/`Output` and a `Throws` for whatever the handler itself can raise
3. Create or update `definitions.ts` with route definitions (handler, schemas, `throws`, OpenAPI metadata)
4. Add the definition import to `src/routes.ts`
5. Run `npm run --workspace=backend typecheck` — zero errors
6. Run `npm run openapi:generate` to regenerate OpenAPI specs and clients
7. Run `npm run verify` — the rules in `standards/` check the `Throws` list against the handler in both directions
