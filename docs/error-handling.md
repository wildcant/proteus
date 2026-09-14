# Error Handling

Standardized error handling infrastructure modeled on Medusa's approach, adapted for this prototype's zero-dep router and Drizzle/postgres.js stack.

## Architecture

```
Route Handler throws → Router catches → errorHandler() → HTTP Response
       ↑                                       ↓
  AppError(type)              { code, type, message } + status
```

Errors flow upward. Route handlers and services throw `AppError` instances. The router's centralized try/catch in `app.ts` catches everything and delegates to `errorHandler()` which maps to HTTP responses. No manual try/catch in route handlers.

## AppError

The core error class. All domain/application errors should be instances of `AppError`.

```ts
import { AppError, ErrorTypes } from '../core/errors/app-error.js'

throw new AppError({
  type: ErrorTypes.NOT_FOUND,
  message: `Customer with id "${id}" not found`,
})
```

### Properties

| Property | Type | Description |
|----------|------|-------------|
| `type` | `ErrorTypes` | Semantic error category |
| `message` | `string` | Human-readable description |
| `code` | `string?` | Optional domain-specific code — see [Domain codes](#domain-codes) |
| `date` | `Date` | When the error occurred |
| `__isAppError` | `true` | Brand flag for runtime detection |

### Error Types

| Type | HTTP Status | API Code | When to use |
|------|-------------|----------|-------------|
| `NOT_FOUND` | 404 | `not_found` | Entity doesn't exist |
| `INVALID_DATA` | 400 | `invalid_request_error` | Validation failure, bad input |
| `INVALID_ARGUMENT` | 400 | `invalid_request_error` | Wrong argument to a function |
| `NOT_ALLOWED` | 400 | `invalid_request_error` | Operation not permitted in current state |
| `UNAUTHORIZED` | 401 | `unauthorized` | Missing/invalid authentication |
| `FORBIDDEN` | 403 | `unauthorized` | Authenticated but insufficient permissions |
| `CONFLICT` | 409 | `invalid_state_error` | Optimistic locking, state conflict |
| `DUPLICATE_ERROR` | 422 | `invalid_request_error` | Logical duplicate (application-level) |
| `UNEXPECTED_STATE` | 500 | `invalid_state_error` | Invariant violation, should-not-happen |
| `DB_ERROR` | 500 | `unknown_error` | Unrecoverable database failure |

### Domain codes

`code` carries the detail `type` is too coarse for — which decline a payment hit, not merely that
something was `NOT_ALLOWED`. **A domain's codes never go in `core/errors/`.** They go in that
domain's port folder as their own enum, in its own file:

```ts
// core/types/payment/errors.ts
export enum PaymentErrorCodes {
  DECLINED = 'payment_declined',
  REQUIRES_ACTION = 'payment_requires_action',
}
```

`AppError` and `ErrorTypes` are domain-agnostic; nine payment-specific members in a core enum made
`core/errors/` know about checkout. `core/types/<domain>/` is already importable by the module, its
providers, the workflows and `test-exports`, so it is the widest surface the codes need without
leaking upward — `core/types/cron-expression.ts` is the precedent for a runtime enum living there.

Three details that are easy to get wrong:

- **Member names drop the domain prefix; wire values keep it.** `PaymentErrorCodes.DECLINED` reads
  as `'payment_declined'` in the response body, because the storefront and the e2e suite branch on
  that string and it has to be unambiguous there.
- **`AppError.code` stays typed `string`.** There is deliberately no union of every domain's codes:
  it would have to be widened each time a domain adds a member, and nothing gains by it.
- **Each member carries the case it is for**, as a doc comment. A code is a contract with the
  storefront; what separates it from its neighbour is the part a caller needs and the name cannot
  say.

### Type Guard

```ts
if (AppError.isError(err)) {
  // err is typed as AppError
}
```

## HTTP Response Shape

All error responses follow the same contract:

```json
{
  "code": "invalid_request_error",
  "type": "invalid_data",
  "message": "Invalid request: name: Expected string, received undefined"
}
```

- `code` — API contract category (clients switch on this)
- `type` — Internal error type (useful for debugging)
- `message` — Human-readable explanation (sanitized for 5xx)

5xx errors always return `"An internal error occurred"` as the message. The real error is logged server-side.

## Database Error Mapping

Database errors are automatically caught and translated via `dbErrorMapper`. This is applied in two places:

1. **BaseRepository proxy** — All repository method calls that return Promises have `.catch(dbErrorMapper)` applied automatically
2. **withTransaction** — The `db.transaction()` call is wrapped with `.catch(dbErrorMapper)`

### Postgres Error Code Mapping

| PG Code | Name | Maps To | Public Message |
|---------|------|---------|----------------|
| 23505 | unique_violation | `INVALID_DATA` | `"Already exists: email = foo@bar.com"` |
| 23502 | not_null_violation | `INVALID_DATA` | `"Cannot be null: column_name"` |
| 23503 | foreign_key_violation | `NOT_FOUND` | `"Referenced entity does not exist"` |
| 42703 | undefined_column | `INVALID_DATA` | `"Invalid field referenced"` |

Unknown database errors are re-thrown as-is (not wrapped).

### Security

- FK violation details are **not** exposed to clients (logged server-side only for 42703)
- Unique constraint info (column + value) **is** exposed since it helps clients fix duplicates
- Undefined column errors use a generic message

## Input Validation

Use `validateBody` with a Zod schema to parse and validate request bodies:

```ts
import { z } from 'zod'
import { validateBody } from '../core/utils/validate-body.js'

const CreateCustomerSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
})

export const POST = async (req: HttpRequest): Promise<HttpResult> => {
  const data = validateBody(CreateCustomerSchema, req.body)
  // data is typed as { name: string; email: string }
  const customer = await customerService.create(data)
  return { status: 201, json: { customer } }
}
```

On failure, throws `AppError(INVALID_DATA)` with up to 3 formatted issues:

```json
{
  "code": "invalid_request_error",
  "type": "invalid_data",
  "message": "Invalid request: name: Expected string, received undefined; email: Expected one of \"valid email\""
}
```

### Supported Zod Issue Formatting

- `invalid_type` — "Expected string, received number"
- `invalid_value` — "Expected one of \"active\" | \"inactive\""
- `unrecognized_keys` — "Unrecognized keys: \"foo\", \"bar\""
- `too_small` — "Expected string to have >=3 characters"
- `too_big` — "Expected string to have <=50 characters"
- Other codes fall back to Zod's default message

## BaseRepository: findByIdOrFail

Convenience method that throws `NOT_FOUND` if the entity doesn't exist:

```ts
// In a service — no manual null check needed
async retrieveCustomer(id: string): Promise<CustomerDTO> {
  return this.customerRepository.findByIdOrFail(id)
}
```

Produces: `AppError { type: NOT_FOUND, message: 'Entity with id "abc" not found' }`

## Logging

| Status Range | Log Level | What's Logged |
|--------------|-----------|---------------|
| 5xx | `console.error` | Full error object (stack trace) |
| 4xx | `console.info` | `"400 invalid_data: message"` |

## Writing Route Handlers

With centralized error handling, route handlers are clean — just call services and return:

```ts
export const GET = async (req: HttpRequest<never, { id: string }>): Promise<HttpResult> => {
  const service = req.scope.resolve<ICustomerModuleService>('customerModuleService')
  const customer = await service.retrieveCustomer(req.params.id)
  return { status: 200, json: { customer } }
}

export const POST = async (req: HttpRequest<CreateCustomerDTO>): Promise<HttpResult> => {
  const service = req.scope.resolve<ICustomerModuleService>('customerModuleService')
  const data = validateBody(CreateCustomerSchema, req.body)
  const [customer] = await service.createCustomers([data], {})
  return { status: 201, json: { customer } }
}
```

No try/catch needed. If `retrieveCustomer` throws NOT_FOUND, the client gets a 404. If `validateBody` rejects, the client gets a 400. If the DB throws a unique violation, the client gets a 400 with "Already exists".

## Enforcement

| Rule id | The claim it enforces |
|---|---|
| `constructs-a-generic-error` | that backend code raises `AppError`, never a bare `Error` |

It matches the *construction* rather than the throw, because the two are routinely written apart:
`const error = new Error(…)` two lines above `throw error`, `Promise.reject(new Error(…))`,
`Object.assign(new Error(…), { status })`, an error handed to a callback. A text search for
`throw new Error(` sees none of them.

Five paths are exempt, each because `AppError` is the wrong answer there rather than because the rule
is inconvenient: `__tests__/` throws deliberately odd errors to be caught two lines down; `src/env.ts`
and `framework/config/` and the loaders run before the container does, so `AppError` is not reachable;
`core/db/` is infrastructure below the error layer, whose failures are programming errors rather than
anything a client should read; and a `core/utils/abstract-*` base class saying "you did not override
this" is talking to the provider author, not to a client. The exemptions are globs in the rule.

One site carries an `ast-grep-ignore` instead. `deserializeError` in
`framework/temporal/failures.ts` rebuilds a plain `Error` on purpose — it is the inverse of
`serializeError`'s `kind: 'plain'` branch, and rebuilding it as an `AppError` would invent a `type`
the Worker never threw, which `errorHandler` would then answer with a status the failure never had.

### What is deliberately not enforced

- **That the `type` is the right one.** Whether a failure is a `CONFLICT` or an `INVALID_DATA` is the
  judgement the enum exists to record; nothing can check it from syntax.
- **That a domain `code` is set where the type is too coarse.** `code` is optional by design, and a
  rule cannot tell a failure that needs one from a failure the type already describes.
- **That a thrown non-`Error` never happens.** `throw 'cart missing'` passes every gate here —
  Biome's `noThrowLiterals` is not on in this repo, and TypeScript permits throwing any value. It
  reaches `errorHandler` as an unrecognised throw and answers 500, the same as a bare `Error` would,
  which is why the rule above is written about `AppError` rather than about `Error` specifically.

## File Layout

```
backend/src/core/errors/
  app-error.ts         — AppError class + ErrorTypes enum
  db-error-mapper.ts   — Postgres error code → AppError translation
  error-handler.ts     — AppError → HTTP response mapping
  format-zod-issues.ts — Zod issue list → one readable message

backend/src/core/types/<domain>/
  errors.ts            — that domain's code enum; import the file, not a barrel (ADR-0028)
```
