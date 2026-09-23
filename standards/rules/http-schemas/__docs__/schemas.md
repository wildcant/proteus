# Schemas

Zod schemas for HTTP request and response validation, and the source `zod-to-openapi` generates the
spec from. This covers what to call a schema, what every one of them must do, and the two constraints
that break something downstream rather than failing here. Timestamps have their own contract in
[datetime fields](./datetimes.md).

## Structure

```
src/
├── common.ts              # Shared types (IdParams, DeleteResponse, PaginatedResponse, dateToIso)
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

`index.ts` is one of the nine barrels ADR-0028 exempts, because a `package.json` `exports` map names
it.

## Shape

```ts
export const AdminProduct = z.object({ ... }).openapi('AdminProduct')
export type AdminProduct = z.input<typeof AdminProduct>
```

## Rules

### A schema is named for its scope, its entity, and what it is

`[Scope][Entity]` for the entity itself — `AdminProduct`, `StoreCart`, `AdminPaymentSession`.

| Response | Pattern | Example |
|---|---|---|
| GET list | `[Scope][Entity]ListResponse` | `AdminProductListResponse` |
| GET by id | `[Scope][Entity]Response` | `AdminCustomerResponse` |
| GET with relations | `[Scope][Entity]DetailResponse` | `AdminFulfillmentSetDetailResponse` |
| POST create | `[Scope]Create[Entity]Response` | `AdminCreateShippingOptionResponse` |
| POST/PUT update | `[Scope]Update[Entity]Response` | `AdminUpdateFulfillmentSetResponse` |
| DELETE | `DeleteResponse` (shared) | `DeleteResponse` |
| Webhook | `WebhookReceivedResponse` (shared) | `WebhookReceivedResponse` |

| Payload | Pattern | Example |
|---|---|---|
| Create body | `[Scope]Create[Entity]` | `AdminCreateProduct` |
| Update body | `[Scope]Update[Entity]` | `AdminUpdateCustomer` |
| List query params | `[Scope][Entity]ListParams` | `AdminCustomerListParams` |

The name is not decoration: it becomes the OpenAPI component name, which becomes the generated
client's exported type in both frontends.

### Every schema exports the runtime value and the type under one name

The zod object for validation and OpenAPI, and the inferred type beside it. TypeScript keeps values
and types in separate namespaces, so both can be called `AdminProduct` and a consumer imports one
name whichever it needs.

### Every schema on the wire calls `.openapi()` with its own export name

Anything appearing in a response or a request body needs `.openapi('SchemaName')`, and the string
must match the export. Without it the schema is inlined into every operation that references it,
so the generated client gets an anonymous duplicate per endpoint instead of one shared type.

### Types use `z.input`, not `z.infer`

Where a schema has a transform the two differ, and entity and response aliases want the input side:

```ts
// z.input<typeof AdminUser> → { createdAt: Date, ... }  ← backend uses this
// z.infer<typeof AdminUser> → { createdAt: string, ... } ← wire format
export type AdminUser = z.input<typeof AdminUser>
```

`dateToIso` is the transform this exists for — see [datetime fields](./datetimes.md).

### `nullable()` and `optional()` are not interchangeable

`nullable()` — the field is always present and may be `null`. `optional()` — the field may be absent
entirely, which is what a relation loaded only on some endpoints needs. The generated client reads
the difference, so guessing produces a type the frontend has to defend against for no reason.

### Generic key-value fields are `z.record(z.string(), z.unknown())`

This version of zod requires both the key and the value type argument.

### A paginated list extends `PaginatedResponse`

```ts
export const AdminProductListResponse = PaginatedResponse.extend({
  products: z.array(AdminProduct),
}).openapi('AdminProductListResponse')
```

### A batch payload gets a batch response

If the payload accepts an array, the response returns one — `z.array(AdminCreateCustomer)` in,
`{ customers: z.array(AdminCustomer) }` out. A batch endpoint answering with a single object makes
the caller guess which element it belongs to.

### No `node:` imports

The package is bundled into the admin browser SPA *and* the store on Cloudflare Workers. Anything
Node-only breaks both. That rules out validating with a real Node parser inside a schema —
`node:util`'s `MIMEType`, say — even when the backend route already uses one.

Keep the isomorphic check in the schema and let the route do the stricter parsing. The route must
convert any parser throw into `AppError(INVALID_DATA)`, or a bare `TypeError` reaches
`error-handler.ts` and answers 500 where 400 was meant.

### No regex flags in `.regex()`

`zod-to-openapi` serialises the flag into the generated JSON Schema `pattern` as literal text: `/^…$/i`
becomes `"^…$/i"`, which no client can match. Spell the alternatives out instead — `[a-zA-Z0-9]`, not
`[a-z0-9]` with `i`.

The leak is invisible until you look at the output, so after changing a schema run
`pnpm -w run openapi:generate` and diff the generated `pattern` and type against what you meant. One
wrinkle when you do: the dump script writes expanded JSON arrays and Biome reformats them compact, so
a regeneration shows thousands of churn lines until Biome has run over `apps/backend/openapi` — do
that before reading the real diff.

### Every message is marked with `i18n.t()`

A message a schema sets is shown to a shopper in their market's language, so it goes through the
catalog: `.min(1, i18n.t('Enter your password'))`, with `i18n` from `@proteus/utils`. The English
sentence is the catalog id; a placeholder is ICU and is filled from the issue's own fields —
`i18n.t('Use {maximum} characters or fewer')`. Schemas stay static English constants, and
`translateIssue` in `src/i18n.ts` translates where the issue is shown. Any field a shopper fills in
carries a message of its own: Zod's bundled Spanish reads badly and is only the fallback for fields no
shopper sees. After marking one, run `pnpm --filter @proteus/http-schemas run i18n:extract`, translate
the new `msgstr` in `locales/es.po`, then `i18n:compile`.

## Enforcement

Two contracts have rules: timestamps, in [datetime fields](./datetimes.md), and marked messages,
`schema-message-not-marked`. Everything else above
is a convention, and `standards/README.md` explains what that means and when it changes.

The `generated` gate is the backstop for several of them: `openapi:generate` is committed and checked
for drift, so a schema change that alters the spec has to be regenerated, and the diff is where a
missing `.openapi()` or a leaked regex flag becomes visible.

## What is deliberately not enforced

- **The naming tables.** A rule could match `export const Admin…` and check the suffix against the
  file it sits in, and it would be a rule about spelling that fires on every legitimate exception —
  `IdParams`, `DeleteResponse`, `PaginatedResponse` are all correctly named and match none of the
  patterns. The generated client is where a bad name is felt, and it is read constantly.
- **That `.openapi()` is called.** Expressible, and worth writing when someone is bitten by it. The
  reason it has not been is that the symptom is loud: the generated client grows a duplicated
  anonymous type, which shows up in the committed `src/api/generated/` diff.
- **`nullable()` versus `optional()`.** Which one a field wants is a fact about the endpoint, not
  about the file. Nothing syntactic distinguishes a correct `optional()` from a careless one.
- **No `node:` imports.** A dependency-cruiser rule could hold this, and does not yet. Until then the
  failure is a build error in the store's workerd bundle or a runtime error in the admin SPA — late,
  but not silent.
- **`z.input` over `z.infer`.** Getting it wrong is a type error at the first backend handler that
  passes a `Date`, which is the `typecheck` gate doing the job a rule would.

## Relationship with routes

A route imports these schemas rather than declaring its own, and its `route.ts` is where the request
one and the response one are bound to a method. The two shared envelopes — `DeleteResponse` and
`WebhookReceivedResponse` — are documented in [routes](../../backend/api/__docs__/routes.md#enforcement)
rather than here, because `delete-route-returns-shared-response` and
`webhook-route-returns-shared-response` read the route file, not the schema.
