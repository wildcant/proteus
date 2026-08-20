# Workerd-Compatible DI: Per-Request Database Lifecycle

**Status:** ready-for-agent

## Problem Statement

The backend-as-library pattern (used by TanStack Start on Cloudflare Workers) fails at runtime because the DI container creates a singleton postgres connection and winston logger at module load time. These I/O objects are shared across requests, which violates the `workerd` runtime's request isolation rules — I/O objects created in one request's context cannot be accessed from another request's handler.

This blocks both local development (via `@cloudflare/vite-plugin`) and production deployment to Cloudflare Workers.

## Solution

Introduce a `DbProvider` port with two implementations — one for Node (singleton pool) and one for Workers (per-request connection via AsyncLocalStorage). Repositories and transaction helpers resolve their database connection through a `getDb()` factory function instead of capturing a concrete `db` instance at construction time. The platform runtime is identified via a `RUNTIME` environment variable (`'node'` | `'workerd'`).

## User Stories

1. As a developer, I want `npm run dev` from the frontend workspace (with `@cloudflare/vite-plugin`) to work without I/O isolation errors, so that I can develop locally against the Workers runtime.
2. As a developer, I want the standalone backend API (`npm run --workspace=backend start`) to continue using a singleton connection pool, so that Node deployments remain efficient.
3. As a developer, I want transactions to work identically on both platforms, so that I don't need platform-specific business logic.
4. As a developer, I want the payment provider loader to register DI dependencies on both platforms, so that payment resolution works regardless of runtime.
5. As a developer, I want the database seeding (payment provider upsert) to run as a separate script in CI/CD, so that Workers bootstrap doesn't require init-time DB writes.
6. As a developer, I want the logger to work on Workers without stream-sharing errors, so that I get useful logs in local dev and production.
7. As a developer, I want existing module service tests to pass without modification, so that the refactoring doesn't break business logic.
8. As a developer, I want to add new modules in the future without needing to know about the per-request lifecycle, so that the platform concern stays encapsulated in the provider layer.
9. As a developer, I want each request on Workers to get a fresh database connection that is disposed after the response, so that no connection leaks occur.
10. As a developer, I want the `RUNTIME` env var to default to `'node'`, so that existing deployments and test suites work without configuration changes.
11. As a developer, I want the `withTransaction` helper to work with the `getDb` factory pattern, so that nested transactions and re-entrant calls behave correctly.
12. As a developer, I want the base repository's `getClient(context)` to still prefer `context.transaction` over the default connection, so that all operations within a transaction use the same transaction handle.

## Implementation Decisions

### New `RUNTIME` environment variable

- Added to the env schema with values `'node'` | `'workerd'`, defaulting to `'node'`.
- Checked by the payment provider loader to conditionally skip the DB upsert.
- Does NOT control which `DbProvider` implementation is used — that is determined by entry point imports (build-time selection).

### `DbProvider` port and two implementations

- **Port** (`src/core/db/ports.ts`): Defines `DbProvider` interface with `getDb(): PostgresJsDatabase` and `withConnection<T>(fn: () => Promise<T>): Promise<T>`.
- **Node provider** (`src/core/db/node-provider.ts`): Creates a singleton postgres client + drizzle instance at init. `getDb()` always returns the same instance. `withConnection` is a passthrough — `(fn) => fn()`.
- **Workers provider** (`src/core/db/workers-provider.ts`): Uses a dedicated `AsyncLocalStorage` instance. `withConnection` creates a postgres client + drizzle instance, stores it in ALS, runs the callback, then calls `client.end()`. `getDb()` reads from ALS and throws if called outside a request context.

### Build-time platform selection via entry points

- The Node standalone entry (`src/index.ts`) imports the node provider and passes `getDb` into container setup.
- The backend-as-library entry (`src/server/api-caller.ts`) imports the workers provider and wraps each `apiCall` in `withConnection()`.
- No runtime branching or conditional imports — tree-shaking removes the unused provider.

### `BaseRepository` constructor change

- Constructor signature changes from `{ db: PostgresJsDatabase }` to `{ getDb: () => PostgresJsDatabase }`.
- Stored as a private field `#getDb`.
- `getClient(context?)` becomes: `return context?.transaction ?? this.#getDb()`.
- Every query invocation calls the factory function. On Node this returns the singleton (negligible overhead). On Workers it reads from ALS.

### `createWithTransaction` change

- Signature changes from `createWithTransaction(db)` to `createWithTransaction(getDb)`.
- Implementation calls `getDb()` to get the current connection, then opens `db.transaction(tx => ...)`.
- Transaction guarantees are preserved: the `tx` handle lives within the callback scope (single request), and all repo operations within the transaction see `context.transaction`.

### Bootstrap changes

- `bootstrapModule` no longer creates a drizzle instance from a raw postgres client. Instead it receives `getDb` from the shared container and passes it to repositories.
- The shared container registers `getDb` (the factory function) instead of a raw pg client.
- Local per-module containers register `getDb` as a value (it's a function, not an I/O object — safe to share).

### Payment provider loader split

- Registration of provider instances into the DI container (lines 31-63 of current loader) ALWAYS runs — this is pure in-memory wiring with no I/O.
- The DB upsert (line 66) is gated by `env.RUNTIME !== 'workerd'`.
- A separate `scripts/seed-providers.ts` script reuses the same upsert logic for CI/CD execution against the production database.

### Logger

- On Workers (`workerd`): Use a console-based logger that implements the same `Logger` interface (log, info, warn, error, debug methods). No streams, no winston.
- On Node: Existing winston logger unchanged.
- Selection happens at container creation time based on `RUNTIME` env var.

### `apiCall` is Workers-only

- `apiCall` (in `src/server/api-caller.ts`) is only used by the backend-as-library path (TanStack Start on Workers). It wraps every call in `dbProvider.withConnection()`.
- The Node standalone path uses `app.ts` route handlers which resolve services from the shared container — no `withConnection` needed since the singleton pool is always available.

## Testing Decisions

### What makes a good test here

The refactoring changes HOW the database connection is obtained (factory vs direct reference) but NOT the external behavior of any module service. Tests should verify that services still produce correct results with the new wiring — not test the factory mechanism itself.

### Modules to test

- **Existing module service tests** (`user`, `customer`, `payment`): Must pass unmodified. The test setup (`tests/setup/test-extend.ts`) provides a real `db` fixture — this will be adapted to provide `getDb: () => db` instead, matching the new constructor signature.
- **`createWithTransaction`**: Existing transaction rollback tests in `customer` module verify this behavior implicitly.
- **Workers provider** (`workers-provider.ts`): A unit test that verifies `getDb()` throws outside `withConnection`, and returns a valid drizzle instance inside it.
- **Node provider** (`node-provider.ts`): A unit test that verifies `getDb()` always returns the same instance.

### Prior art

- Module service tests in `src/modules/user/__tests__/user-module-service.test.ts` — uses real DB, creates service with explicit dependencies, tests external behavior.
- The test fixture system (`test.extend<Fixtures>`) already provides `db` and `logger` — adapting it to provide `getDb` is straightforward.
- Transaction rollback testing in customer module tests — verifies partial operations don't leave state.

## Out of Scope

- Cloudflare Hyperdrive integration (connection pooling optimization for production Workers) — follow-up work once the basic per-request pattern is proven.
- Replacing `awilix` with `awilix/browser` export — may be needed for production Workers build if `fast-glob` causes bundle issues, but not required for local dev with `nodejs_compat`.
- Frontend-side changes beyond removing the `console.log(process.env)` debug statement in `vite.config.ts`.
- Refactoring the `vite.config.ts` env var passthrough to use `.dev.vars` (Cloudflare's native mechanism) — current `dotenvx` + `config.vars` approach works.
- Production deployment pipeline (CI/CD scripts, Wrangler config for production secrets).
- Winston-to-structured-logging migration for Workers observability.

## Further Notes

- The `postgres` package (postgres.js) supports both TCP and WebSocket transports. For production Workers without Hyperdrive, WebSocket transport to the managed Postgres host may be needed. This is a connection string change, not an architectural one.
- ADR 0001 (per-module container isolation) remains fully respected — `getDb` is bridged into local containers the same way `db` was before.
- ADR 0011 (module loaders) is extended with the `RUNTIME` gate — loaders still run, they just conditionally skip DB operations on `workerd`.
- The `AsyncLocalStorage` instance for the Workers db provider is independent from TanStack Start's own ALS (used for H3Event). This avoids coupling to framework internals.
