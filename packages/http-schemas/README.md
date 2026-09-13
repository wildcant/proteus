# @proteus/http-schemas

Zod schemas for HTTP request/response validation and OpenAPI spec generation.

## Directory Structure

```
src/
├── common.ts              # Shared types (IdParams, DeleteResponse, PaginatedResponse, etc.)
├── admin/
│   ├── <domain>/
│   │   ├── entities.ts    # Zod schemas for domain objects
│   │   ├── payloads.ts    # Request body schemas
│   │   ├── queries.ts     # Query param / list filter schemas
│   │   ├── responses.ts   # Response envelope schemas
│   │   └── index.ts       # Re-exports all four
│   └── index.ts
└── store/
    └── <domain>/          # Same structure as admin
```

## Naming Conventions

### Entities

`[Scope][Entity]` — e.g. `AdminProduct`, `StoreCart`, `AdminPaymentSession`

### Response Schemas

| Operation         | Pattern                             | Example                              |
|-------------------|-------------------------------------|--------------------------------------|
| GET list          | `[Scope][Entity]ListResponse`       | `AdminProductListResponse`           |
| GET by id         | `[Scope][Entity]Response`           | `AdminCustomerResponse`              |
| GET with relations| `[Scope][Entity]DetailResponse`     | `AdminFulfillmentSetDetailResponse`  |
| POST create       | `[Scope]Create[Entity]Response`     | `AdminCreateShippingOptionResponse`  |
| POST/PUT update   | `[Scope]Update[Entity]Response`     | `AdminUpdateFulfillmentSetResponse`  |
| DELETE            | `DeleteResponse` (shared)           | `DeleteResponse`                     |
| Webhook           | `WebhookReceivedResponse` (shared)  | `WebhookReceivedResponse`            |

### Payload Schemas

| Operation         | Pattern                             | Example                              |
|-------------------|-------------------------------------|--------------------------------------|
| Create body       | `[Scope]Create[Entity]`             | `AdminCreateProduct`                 |
| Update body       | `[Scope]Update[Entity]`             | `AdminUpdateCustomer`                |
| List query params | `[Scope][Entity]ListParams`         | `AdminCustomerListParams`            |

## Two constraints on every schema

Both are invisible until something downstream breaks, and neither is caught by typecheck.

### No `node:` imports

The package is bundled into the admin browser SPA *and* the store on Cloudflare Workers. Anything
Node-only breaks both. That rules out validating with a real Node parser inside a schema — `node:util`'s
`MIMEType`, say — even when the backend route already uses one.

Keep the isomorphic check in the schema and let the route do the stricter parsing. The route must
convert any parser throw into `AppError(INVALID_DATA)`, or a bare `TypeError` reaches
`error-handler.ts` and answers 500 where 400 was meant.

### No regex flags in `.regex()`

zod-to-openapi serialises the flag into the generated JSON Schema `pattern` as literal text:
`/^…$/i` becomes `"^…$/i"`, which no client can match. Spell the alternatives out instead —
`[a-zA-Z0-9]`, not `[a-z0-9]` with `i`.

The leak is invisible until you look at the output, so after changing a schema run
`pnpm -w run openapi:generate` and diff the generated `pattern` and type against what you meant. One
wrinkle when you do: the dump script writes expanded JSON arrays and Biome reformats them compact,
so a regeneration shows thousands of churn lines until Biome has run over `apps/backend/openapi` —
do that before reading the real diff.

## Patterns

### Dual export (runtime value + type)

Every schema exports both the zod object (for runtime validation / OpenAPI) and the inferred type:

```ts
export const AdminProduct = z.object({ ... }).openapi('AdminProduct')
export type AdminProduct = z.input<typeof AdminProduct>
```

### OpenAPI names

Every schema that appears in API responses or request bodies must call `.openapi('SchemaName')` with a unique name matching the export name.

### Datetime fields — the `dateToIso` pipeline

A timestamp keeps one shape until the last moment: the column is `timestamptz`, Drizzle returns a
`Date`, the DTO carries that `Date`, and the ISO string is produced here, at the HTTP edge. Timestamp
fields use the `dateToIso` pipeline from `common.ts`, which accepts a `Date` and outputs an ISO 8601 string:

```ts
export const dateToIso = z
  .date()
  .transform((d) => d.toISOString())
  .pipe(z.iso.datetime({ offset: true }))
```

For the standard `createdAt` / `updatedAt` / `deletedAt` trio, spread `...timestamps.shape`:

```ts
export const AdminUser = z.object({
  id: z.string(),
  name: z.string(),
  ...timestamps.shape,
}).openapi('AdminUser')
```

### `z.input` vs `z.infer` for schemas with transforms

Because `dateToIso` has a transform, `z.infer` gives the *output* type (`string`) while `z.input` gives the *input* type (`Date`). Entity and response type aliases use `z.input` so the backend can pass `Date` objects:

```ts
// z.input<typeof AdminUser> → { createdAt: Date, ... }  ← backend uses this
// z.infer<typeof AdminUser> → { createdAt: string, ... } ← wire format
export type AdminUser = z.input<typeof AdminUser>
```

### Parsing dates from query params

For filtering on date fields (e.g. `?createdAt[$gte]=2026-01-01`), use `createDateOperatorMap()` which parses ISO strings into `Date` objects via `z.coerce.date()`:

```ts
export function createDateOperatorMap() {
  const t = z.coerce.date().optional()
  return z.object({ $eq: t, $ne: t, $gt: t, $gte: t, $lt: t, $lte: t })
}
```

### Nullable vs optional

- `nullable()` — field is always present but may be `null`
- `optional()` — field may be omitted entirely (use for relation fields that are conditionally loaded)

### Records

Use `z.record(z.string(), z.unknown())` for generic key-value metadata/data fields. This version of zod requires both key and value type arguments.

### Paginated list responses

Extend `PaginatedResponse` from common:

```ts
export const AdminProductListResponse = PaginatedResponse.extend({
  products: z.array(AdminProduct),
}).openapi('AdminProductListResponse')
```

### Shared delete response

All DELETE endpoints use the shared `DeleteResponse` from `common.ts` — don't create per-domain delete schemas.

### Batch endpoints

If the payload accepts an array, the response should return an array too:

```ts
// payload: z.array(AdminCreateCustomer)
// response: { customers: z.array(AdminCustomer) }
```
