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
| unset / `required` / `optional` / `unregistered` | `[{ bearerAuth: [] }]` | yes |
| `public` | `[]` | only with `returnsUnauthorized: true` |

A `public` route has no auth middleware, so it declares no `401` by default. A public route whose *handler* rejects credentials — `/store/auth/login`, `/store/auth/signup` — sets `returnsUnauthorized: true` so the spec still declares the response it really sends. Never set it on a route that cannot return a `401`: the spec should not promise a response the API never sends.

### Tags

The document's root `tags` array is derived from the registered route definitions, not hand-maintained — admin uses 17 tags and store 7, and a hardcoded list rots the first time a route gains one. Adding a tag to a route is enough; add the tag itself to the `Tags` enum in `backend/src/framework/http/types.ts`.

### Path naming

Paths name resources, not actions — the method is the verb. `POST /auth/:actorType/:authProvider/password` replaced `.../update`, which read as a verb in the path while keeping the same `operationId` (`authUpdatePassword`) and therefore the same generated client function name.

### Dumping the spec to a file

```bash
npm run openapi:generate
```

This writes `apps/backend/openapi/openapi-admin.json` and `openapi-store.json` without a running server, then regenerates the Orval clients for admin and store. Both specs and both clients are committed — regenerate and commit them in the same change as any route, schema or tag edit.

`openapi:dump:offline` runs through `dotenvx`, so it needs `.env.keys` at the repo root (`npm run pull-keys`). `npm run --workspace=backend openapi:dump` is the alternative: it curls a running server instead.

### Key files

| File | Purpose |
|------|---------|
| `packages/http-schemas/src/openapi-setup.ts` | Calls `extendZodWithOpenApi(z)` — must be imported before any `.openapi()` usage |
| `backend/src/core/openapi/registry.ts` | `createRegistry()`, `generateDocument()`, the `bearerAuth` scheme, the derived tag list and the per-document `documentInfo` (title + description) |
| `backend/src/core/openapi/register-route.ts` | Converts a `RouteDefinition` to a `registry.registerPath()` call — path, operation `security` and the synthesised `200` / `400` / `401` / `404` responses |
| `backend/scripts/openapi-dump.ts` | Writes both specs to `apps/backend/openapi/` |

### How `$ref` works

Schemas that call `.openapi('Name')` are registered in `components/schemas` and referenced via `$ref` throughout the spec. Schemas without `.openapi()` are inlined. Use `.openapi()` on entity and payload schemas to keep the spec clean:

```
components/schemas/Customer    ← from Customer.openapi('Customer')
components/schemas/CreateCustomer  ← from CreateCustomer.openapi('CreateCustomer')
```

---

## Backend-as-library

The middleware system only applies to the HTTP layer. When the store imports the backend container directly (via `createServerFn`), it bypasses the router entirely:

- **HTTP path**: Request → middleware (validates) → handler → service
- **Direct import path**: `createServerFn` → container → service

The store can import the same Zod schemas from `core/http-schemas/` for its own validation in TanStack's `.validator()`:

```typescript
import { CreateCustomers } from 'backend/src/core/http-schemas/customer/payloads.js'

export const createCustomers = createServerFn({ method: 'POST' })
  .validator((data) => CreateCustomers.parse(data))
  .handler(async ({ data }) => {
    // ...
  })
```

---

## Adding middleware to a new module

1. Create HTTP schemas in `backend/src/core/http-schemas/<domain>/` (entities, payloads, queries, responses)
2. Call `.openapi('Name')` on entity and payload schemas (import `openapi/setup.js` first)
3. Re-export from `backend/src/core/http-schemas/index.ts`
4. Add a tag to the `Tags` enum in `backend/src/core/middleware/types.ts`
5. Create `backend/src/api/<domain>/middlewares.ts` with route configs
6. Remove manual `validateBody()` / `validateQuery()` calls from handlers
