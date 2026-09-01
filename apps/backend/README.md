# Backend

Standalone API server built with Ports & Adapters architecture, Drizzle ORM, and Awilix DI. See the root [CLAUDE.md](../../CLAUDE.md) for full architecture overview.

## Temporal (local stack)

Temporal runs in the dev Compose stack so a durable workflow engine is available locally without
extra setup. Nothing in the application uses it yet — `createWorkflow(...).run()` still goes through
the in-process simple adapter (`src/core/workflows/simple-adapter.ts`). This stage is infrastructure
plus a throwaway `ping` workflow that proves the round-trip.

### Starting it

```bash
docker compose -f apps/backend/docker-compose.yml up -d --wait   # postgres, temporal, temporal-ui
npm run --workspace=backend worker                               # in one shell
npm run --workspace=backend temporal:ping                        # in another
```

The UI is at <http://localhost:8080>; the gRPC frontend is at `localhost:7233`. `temporal:ping`
starts a workflow, waits for it, and prints what the activity returned — the execution and its full
history then show up in the UI.

The Worker needs `@temporalio/core-bridge`, a native addon, so it is a **Node-only** process.
`npm run dev:workerd` and the Cloudflare deployment neither run nor bundle it.

### It shares the Postgres you already have

`temporalio/auto-setup` points at the existing `postgres` service and creates two databases of its
own, `temporal` and `temporal_visibility`, alongside `proteus`. One server, one volume, three
databases.

The one thing worth knowing: **`npm run db:reset` is safe.** It drops and recreates `proteus` only,
so workflow history survives. `docker compose down -v` is the command that destroys it, along with
everything else in the volume.

### Configuration

`TEMPORAL_ADDRESS` (default `localhost:7233`) and `TEMPORAL_NAMESPACE` (default `default`) are
connection settings, and nothing more. Which engine executes a workflow is not an env var.

### Tests

`src/temporal/__tests__/ping.test.ts` runs the round-trip against `@temporalio/testing`'s
time-skipping test server, which the SDK starts in-process. It needs no Compose stack, so
`npm run verify` keeps working for contributors who have never started Temporal.

## Date Handling

Dates flow through three layers, each with a single canonical representation:

| Layer | Type | Example |
|-------|------|---------|
| Database | `timestamp with time zone` | `2026-08-03 12:00:00+00` |
| Application (services, DTOs, repositories) | `Date` | `new Date()` |
| API (JSON responses) | ISO 8601 string | `"2026-08-03T12:00:00.000Z"` |

### Database columns

All timestamp columns use Drizzle's built-in `timestamp({ withTimezone: true })`, which returns native `Date` objects. The shared `timestamps` helper in `src/core/db/columns.ts` defines `createdAt`, `updatedAt`, and `deletedAt` for every table:

```ts
import { timestamp } from 'drizzle-orm/pg-core'

export const timestamps = {
  createdAt: timestamp({ withTimezone: true }).default(sql`now()`).notNull(),
  updatedAt: timestamp({ withTimezone: true }).default(sql`now()`).notNull(),
  deletedAt: timestamp({ withTimezone: true }),
}
```

Event-specific timestamps (e.g. `capturedAt`, `shippedAt`) use `timestamp({ withTimezone: true })` directly. Drizzle's `casing: 'snake_case'` config handles the camelCase-to-snake_case mapping automatically, so explicit column names are unnecessary.

### Application layer

Services and repositories work exclusively with `Date` objects. Never call `.toISOString()` in application code — the API layer handles serialization.

### API layer — the `dateToIso` pipeline

The `dateToIso` Zod pipeline in `packages/http-schemas/src/common.ts` converts `Date` to an ISO string during response serialization:

```ts
export const dateToIso = z
  .date()
  .transform((d) => d.toISOString())
  .pipe(z.iso.datetime({ offset: true }))
```

Entity schemas use `dateToIso` for individual date fields and spread `...timestamps.shape` for the standard trio:

```ts
export const AdminUser = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string(),
  ...timestamps.shape, // createdAt, updatedAt, deletedAt
})
```

