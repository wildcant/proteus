# Middleware, HTTP Schemas & OpenAPI

This guide covers the declarative middleware system, the HTTP schema conventions, and automatic OpenAPI generation.

---

## Overview

Every API directory can have a `middlewares.ts` file that declares validation schemas and OpenAPI metadata for all routes in that subtree. The route loader picks these up at startup to:

1. **Validate** request params, query, and body before the handler runs
2. **Generate** an OpenAPI 3.1 spec from the same schemas
3. **Serve** interactive Swagger UI at `/docs/`

Handlers receive pre-validated data — no manual `validateBody()` calls needed.

---

## HTTP Schemas

Schemas live in `backend/src/core/http-schemas/`, organized by domain following Medusa's naming conventions.

### Directory structure

```
backend/src/core/http-schemas/
├── index.ts              # barrel re-export
├── common.ts             # shared schemas (IdParams, etc.)
└── <domain>/
    ├── index.ts          # re-exports all domain schemas
    ├── entities.ts       # entity shapes (response models)
    ├── payloads.ts       # request body schemas (create/update)
    ├── queries.ts        # query parameter schemas
    └── responses.ts      # response wrapper schemas
```

### Naming conventions

| File | Pattern | Examples |
|------|---------|----------|
| `entities.ts` | `{Entity}` | `Customer` |
| `payloads.ts` | `{Verb}{Entity}` | `CreateCustomer`, `UpdateCustomer` |
| `queries.ts` | `{Entity}Params` / `{Entity}Filters` | `CustomerParams` |
| `responses.ts` | `{Entity}Response` / `{Entity}ListResponse` / `{Entity}DeleteResponse` | `CustomerResponse`, `CustomerListResponse` |
| `common.ts` | Shared utilities | `IdParams` |

### Registering schemas for OpenAPI `$ref`

To avoid inlining the same schema in every endpoint, call `.openapi('Name')` on entity and payload schemas. This registers them in `components/schemas` and all usages become `$ref` references.

```typescript
// entities.ts
import '../../../openapi/setup.js'
import { z } from 'zod'

export const Customer = z
  .object({
    id: z.string(),
    first_name: z.string(),
    // ...
  })
  .openapi('Customer')
```

The `import '../../../openapi/setup.js'` must come before any `.openapi()` call — it extends Zod with the OpenAPI method.

---

## Middleware

### The `middlewares.ts` file

Each API subdirectory (e.g. `api/customers/`) has **one** `middlewares.ts` that covers all routes in the subtree, including nested paths like `/customers/:id`. The `matcher` field identifies which route each entry applies to.

```typescript
// backend/src/api/customers/middlewares.ts
import { IdParams } from '../../core/http-schemas/common.js'
import { CreateCustomers, UpdateCustomer } from '../../core/http-schemas/customer/payloads.js'
import { CustomerListResponse, CustomerResponse, CustomerDeleteResponse } from '../../core/http-schemas/customer/responses.js'
import type { MiddlewareRoute } from '../../core/middleware/types.js'
import { Tags } from '../../core/middleware/types.js'

export default [
  {
    method: 'GET',
    matcher: '/customers',
    operationId: 'listCustomers',
    summary: 'List customers',
    tags: [Tags.CUSTOMERS],
    responseSchema: CustomerListResponse,
  },
  {
    method: 'POST',
    matcher: '/customers',
    bodySchema: CreateCustomers,
    operationId: 'createCustomers',
    summary: 'Create customers',
    tags: [Tags.CUSTOMERS],
    responseSchema: CustomerListResponse,
  },
  {
    method: 'GET',
    matcher: '/customers/:id',
    paramsSchema: IdParams,
    operationId: 'getCustomer',
    summary: 'Retrieve a customer',
    tags: [Tags.CUSTOMERS],
    responseSchema: CustomerResponse,
  },
  // ...
] satisfies MiddlewareRoute[]
```

### MiddlewareRoute fields

| Field | Required | Description |
|-------|----------|-------------|
| `method` | Yes | HTTP method (`GET`, `POST`, `PUT`, `PATCH`, `DELETE`) |
| `matcher` | Yes | Route path (e.g. `/customers/:id`) |
| `paramsSchema` | No | Zod schema for path params — validated before handler |
| `querySchema` | No | Zod schema for query params — validated before handler |
| `bodySchema` | No | Zod schema for request body — validated before handler |
| `responseSchema` | No | Zod schema for response — used for OpenAPI docs only (not validated at runtime) |
| `summary` | No | OpenAPI summary |
| `description` | No | OpenAPI description |
| `operationId` | Yes | Unique operation name — used by Orval to generate function/type names |
| `tags` | Yes | OpenAPI tags — use the `Tags` enum |

### Tags

Tags are defined as an enum in `backend/src/core/middleware/types.ts`. Add new tags there when creating a new module:

```typescript
export const Tags = {
  CUSTOMERS: 'Customers',
  USERS: 'Users',
} as const
```

### How it works

The route loader (`backend/src/routes-loader.ts`) handles everything automatically:

1. Discovers `middlewares.ts` files in each API subdirectory
2. Matches middleware configs to route handlers by `matcher` + `method`
3. Wraps matched handlers with validation (function composition at registration time)
4. Registers matched routes with the OpenAPI registry

Routes without a matching middleware config continue to work unchanged — they just don't get automatic validation or OpenAPI docs.

### Simplified handlers

With middleware handling validation, route handlers become simpler:

```typescript
// Before (manual validation)
export const POST = async (req: HttpRequest): Promise<HttpResult> => {
  const body = validateBody(CreateCustomersBody, req.body)
  const customerService = req.scope.resolve<ICustomerModuleService>(Modules.CUSTOMER)
  const customers = await customerService.createCustomers(body)
  return { status: 201, json: { customers } }
}

// After (middleware validates)
export const POST = async (req: HttpRequest<CreateCustomerDTO[]>): Promise<HttpResult> => {
  const customerService = req.scope.resolve<ICustomerModuleService>(Modules.CUSTOMER)
  const customers = await customerService.createCustomers(req.body)
  return { status: 201, json: { customers } }
}
```

Use the `HttpRequest<TBody>` generic to type the pre-validated body.

### Query params a middleware reads: `contextQuery`

`input.query` answers *which rows the caller wants*. `applyMiddleware` destructures it into
`{ pagination, filters }`, and everything that is not `offset`/`limit`/`order`/`q` lands in
`filters`, where a repository is offered it as a column filter. It is also GET-only, in both the
runtime and the spec.

Some query params answer a different question — *where is this request coming from* — and are read
by a middleware off the raw `req.query`, before any validation runs. Those go in `contextQuery`:

```typescript
// apps/backend/src/api/store/carts/route.ts
export const PostInput = { body: CreateCart, contextQuery: StorePricingContextParams }
export const PostMiddlewares = [setPricingContext()] as const
```

Declaring them in `input.query` instead would put `countryCode` in `filters` and offer it to the
product repository as a column that does not exist — silently ignored — and would document nothing
at all on a POST.

`contextQuery` has no runtime effect. The middleware parses the params itself
(`api/store/middlewares.ts`); the declaration exists so `registerOpenApiRoute` can document them,
on every method rather than only GET, merging them into the operation's single query schema
alongside `input.query` when a GET has both. Without it the param is real but invisible: absent
from the spec, and therefore absent from the Orval client the storefront calls through.

It is declared on the `<Method>Input` constant beside the handler, not in `definitions.ts`, so the
declaration travels with the constant. Two rules keep it paired with the middleware that reads it —
`route-omits-context-query` and `route-declares-unread-context-query`, in
`standards/rules/backend/api/`.

---

## OpenAPI & Swagger UI

Two documents are generated, one per namespace: `Admin API` from `adminDefinitions` and `Store API` from `storeDefinitions` (`backend/src/routes.ts`). Each carries its own `info.description` and its own `tags` list.

### Endpoints

| URL | Description |
|-----|-------------|
| `GET /admin/openapi.json` | Raw OpenAPI 3.1 JSON spec for the admin API |
| `GET /store/openapi.json` | Raw OpenAPI 3.1 JSON spec for the store API |
| `GET /admin/docs/` | Interactive Swagger UI for the admin API |
| `GET /store/docs/` | Interactive Swagger UI for the store API |

### Security

Both documents publish a single security scheme, `bearerAuth` (`http` / `bearer` / `JWT`). Admin and store share one `Authorization` header and differ only by the actor claim inside the token, so one name covers both.

The scheme is also the document-level `security` default. Spectral reads that JSONPath literally and does not apply OpenAPI's root-to-operation inheritance, so `registerOpenApiRoute` additionally writes `security` on **every** operation, derived from the route's `auth` policy:

| `auth` | Operation `security` | Operation declares `401` |
|--------|----------------------|--------------------------|
| unset / `required` / `optional` / `unregistered` | `[{ bearerAuth: [] }]` | yes — the middleware sends it before the handler runs |
| `public` | `[]` | only if the route's `throws` names `UNAUTHORIZED` |

A `public` route has no auth middleware, so its `401` — like every other failure status — comes from the route's declared `throws`.

### Error responses

`output` is the success half of a route's contract; **`throws` is the failure half**. It lists the `ErrorTypes` the route can end with, and `registerOpenApiRoute` turns each one into a declared response through `typeToStatus` — the same map `errorHandler` answers with at runtime. That shared map is the point: the spec cannot promise a status the API does not send, or omit one it does.

The declaration lives next to the handler it describes, as a sibling of `PostInput` and `PostOutput`:

```ts
// src/api/store/auth/signup/route.tsexport const PostThrows = [ErrorTypes.CONFLICT, ErrorTypes.INVALID_DATA, ErrorTypes.UNAUTHORIZED, ...completeCustomerAuthWorkflow.throws] as const
```

Two statuses are *not* listed, because the definition already implies them: the `400` from schema validation, and the `401` an auth middleware sends on any non-public route.

**Errors raised inside a workflow are spread, never restated.** A workflow declares its own contract in its `createWorkflow` config, and whatever calls it — a route, or another workflow — spreads `.throws`:

```ts
export const completeCartWorkflow = createWorkflow<CompleteCartInput, OrderDTO>(
  { name: 'complete-cart', throws: [ErrorTypes.CONFLICT, ErrorTypes.INVALID_DATA, ErrorTypes.NOT_ALLOWED] },
  async (ctx, input) => { ... },
)
```

Spreading rather than restating is what makes this work at any depth: `storeAuthLogin` inherits a `409` raised four frames down, in a step of a workflow called by the workflow it calls, without anything in between knowing about it. A step that lives in its own file exports its own `…Throws` for the same reason — see `setAuthAppMetadataThrows`.

`throws` names the *complete* failure contract, including `UNEXPECTED_STATE` and the other invariant violations, because the rules in `standards/` cannot otherwise tell a missing declaration from a deliberate one. The published document drops the `5xx` half: a server error is not something the caller can reshape a request to avoid, and declaring it puts a dead branch in every generated client.

Five rules keep the declarations honest, in both directions, and they run in the `standards` gate:

| Rule | Catches |
|------|---------|
| `route-throws-undeclared-error` | a handler raises a type its `Throws` export omits |
| `route-declares-unthrown-error` | a `Throws` export names a type nothing in the file raises |
| `workflow-throws-undeclared-error` | the same, for a workflow's `createWorkflow` config |
| `workflow-declares-unthrown-error` | the same, in reverse |
| `route-omits-workflow-errors` | a `.run()` call whose caller does not spread the callee's `.throws` |

Their scope is one file and syntactic, so a type raised by a **module service** the handler calls is invisible to them — `auth-module-service.ts` raises `UNAUTHORIZED` from `updateProvider`, and nothing declares it. Declaring such a type is correct and trips `*-declares-unthrown-error`; suppress that one site by id with the reason written above it, as `standards/README.md` describes. Until that tier is covered, `registerOpenApiRoute` also keeps declaring a `404` on any route that takes a path parameter.

### Tags

The document's root `tags` array is derived from the registered route definitions, not hand-maintained — admin uses 17 tags and store 7, and a hardcoded list rots the first time a route gains one. Adding a tag to a route is enough; add the tag itself to the `Tags` enum in `backend/src/framework/http/types.ts`.

### Path naming

Paths name resources, not actions — the method is the verb. `POST /auth/:actorType/:authProvider/password` replaced `.../update`, which read as a verb in the path while keeping the same `operationId` (`authUpdatePassword`) and therefore the same generated client function name.

### Dumping the spec to a file

```bash
pnpm run openapi:generate
```

This writes `apps/backend/openapi/openapi-admin.json` and `openapi-store.json` without a running server, then regenerates the Orval clients for admin and store. Both specs and both clients are committed — regenerate and commit them in the same change as any route, schema or tag edit.

`openapi:dump:offline` runs through `dotenvx`, so it needs `.env.keys` at the repo root (`pnpm run pull-keys`).

The dump is the only authority on how the spec files are formatted. Biome skips `apps/backend/openapi/openapi-*.json` for exactly that reason — a formatter and a generator disagreeing over the same file produces a whole-file diff on every regeneration, and the drift hook below would then fail for a reason that has nothing to do with drift. `--out-dir <dir>` writes the pair somewhere else; the hook uses it to dump into a temp directory.

---

## Linting the spec

```bash
pnpm --filter backend run check:openapi
```

Spectral lints both committed specs against `apps/backend/openapi/ruleset.yaml` — the one hand-written file in that directory. It also runs inside `pnpm run verify` as the `openapi` suite.

The ruleset extends `spectral:oas` and adds guards for the conventions this repo cares about: kebab-case paths with no verb in them, camelCase schema properties and `operationId`s, every property typed, every `…At` property serialised as a `date-time` string, and a documented security scheme with a `security` block on every operation plus a `401` on every authenticated one.

`--fail-severity=error` is passed explicitly, and it is deliberately *not* the `--error-on-warnings` that the lint suite gives Biome. Two rules — `proteus-request-strings-are-bounded` and `proteus-request-arrays-are-bounded` — are still `warn` because the request bodies they cover are not bounded yet. Raising the gate to fail on warnings would fail the build today.

Two rules need care if you edit them:

- **Asserting a field exists needs `function: schema` with `required`, not a `field:`-scoped function.** Spectral only runs a `field:`-scoped function when that field is present, so `then: { field: format, function: pattern }` silently skips the property that has no `format` at all — precisely the violation. `proteus-timestamps-are-iso` uses the `schema` form for this reason.
- **`proteus-operation-security-defined` uses `defined`, not `truthy`.** A public operation declares `security: []`, and an empty array is falsy. The empty array is the point: it says "no auth required" explicitly rather than by omission.

A guard that cannot fail is not a guard. When adding a rule, introduce the violation into a copy of a spec and confirm the rule reports it before trusting a clean run.

---

## Spec drift: the pre-commit hook

The committed specs are generated, so a change to the routes or schemas they are built from leaves them stale unless someone remembers to regenerate. `.githooks/pre-commit` is what remembers.

It runs only when the staged diff touches something that can change a spec:

- `apps/backend/src/api/**`
- `apps/backend/src/framework/http/openapi/**`
- `packages/http-schemas/**`

When it does run, it dumps both specs into a temp directory and diffs them against the staged versions. On a difference it fails the commit and prints the remedy:

```bash
pnpm run openapi:generate
```

**The hook never writes into the working tree.** A hook that regenerated files mid-commit would stage changes the developer never wrote and never reviewed, so it only ever reads. It compares against the *index* rather than the working tree, so regenerating without staging the result still fails.

Installation carries no dependency — no husky, no lefthook. The root `prepare` script points git at the directory:

```json
"hooks:install": "git rev-parse --git-dir > /dev/null 2>&1 && git config core.hooksPath .githooks || true"
```

`pnpm install` runs the root `prepare`, so a fresh clone is set up by `pnpm run setup` or by installing at all.

Two limits, both accepted: `--no-verify` skips the hook, and it does not run in CI. It catches the mistake for developers rather than gating the branch. The hook also needs `.env.keys` to decrypt `.env.test` for the dump; without it the hook fails and says so.

### Key files

| File | Purpose |
|------|---------|
| `packages/http-schemas/src/openapi-setup.ts` | Calls `extendZodWithOpenApi(z)` — must be imported before any `.openapi()` usage |
| `backend/src/framework/http/openapi/registry.ts` | `createRegistry()`, `generateDocument()`, the `bearerAuth` scheme, the derived tag list and the per-document `documentInfo` (title + description) |
| `backend/src/framework/http/openapi/register-route.ts` | Converts a `RouteDefinition` to a `registry.registerPath()` call — path, operation `security` and the synthesised `200` / `400` / `401` / `404` responses |
| `backend/scripts/openapi-dump.ts` | Writes both specs to `apps/backend/openapi/`, or to `--out-dir` |
| `backend/openapi/ruleset.yaml` | The Spectral rules `check:openapi` enforces — hand-written, unlike the two JSON files beside it |
| `.githooks/pre-commit` | Fails a commit that changes a spec's sources without regenerating the specs |

### How `$ref` works

Schemas that call `.openapi('Name')` are registered in `components/schemas` and referenced via `$ref` throughout the spec. Schemas without `.openapi()` are inlined. Use `.openapi()` on entity and payload schemas to keep the spec clean:

```
components/schemas/Customer    ← from Customer.openapi('Customer')
components/schemas/CreateCustomer  ← from CreateCustomer.openapi('CreateCustomer')
```

---

## Adding middleware to a new module

1. Create HTTP schemas in `backend/src/core/http-schemas/<domain>/` (entities, payloads, queries, responses)
2. Call `.openapi('Name')` on entity and payload schemas (import `openapi/setup.js` first)
3. Re-export from `backend/src/core/http-schemas/index.ts`
4. Add a tag to the `Tags` enum in `backend/src/core/middleware/types.ts`
5. Create `backend/src/api/<domain>/middlewares.ts` with route configs
6. Remove manual `validateBody()` / `validateQuery()` calls from handlers
