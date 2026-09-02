# Backend

Standalone API server built with Ports & Adapters architecture, Drizzle ORM, and Awilix DI. See the root [CLAUDE.md](../../CLAUDE.md) for full architecture overview.

## Temporal (local stack)

**On Node, Temporal is the engine that runs your workflows.** `RUNTIME` defaults to `node`, and
`src/core/workflows/engine-selection.ts` resolves `node` to the Temporal adapter — so under
`npm run dev` every `createWorkflow(...).run()` becomes an execution on the `proteus` task queue and
is executed step by step by a Worker. The in-process simple adapter
(`src/core/workflows/simple-adapter.ts`) is what `npm run dev:workerd` and the Cloudflare deployment
get, because workerd cannot load Temporal's native Worker. Which engine runs is never an env var —
see `src/core/workflows/readme.md`.

### Starting it

```bash
docker compose -f apps/backend/docker-compose.yml up -d --wait   # postgres, temporal, temporal-ui, worker
npm run --workspace=backend dev
```

That is the whole setup. The stack includes a **`worker` service** that polls `proteus`, so a
workflow route works with nothing started by hand. `--wait` returns once the Worker is actually
polling — the healthcheck asks Temporal for the queue's pollers rather than checking that a process
exists, because a queue nobody polls does not fail a request, it hangs it: `workflow.execute` is
called with no execution timeout.

The `worker` service builds `Dockerfile.worker` and bind-mounts `src/` over the image, so editing a
step action needs only `docker compose -f apps/backend/docker-compose.yml restart worker`. A
dependency change needs `--build`. It reads `.env.local` the same way the API does, so
`npm run setup` (which fetches `.env.keys`) must have run first — the same precondition `npm run dev`
already has. Compose overrides only the two addresses that differ inside the network: Postgres and
Temporal are reached by service name rather than on `localhost`.

**Iterating on Worker code itself is what `npm run --workspace=backend worker` is for.** It runs the
same entrypoint through the same script, on the host, with no container in the loop:

```bash
docker compose -f apps/backend/docker-compose.yml stop worker   # don't let two Workers share the queue
npm run --workspace=backend worker
```

The UI is at <http://localhost:8080>; the gRPC frontend is at `localhost:7233`. Every execution and
its full history show up there — including the one a route just dispatched.
`npm run --workspace=backend temporal:ping` is a standalone round-trip probe left from the first
stage.

The Worker needs `@temporalio/core-bridge`, a native addon, so it is a **Node-only** process.
`npm run dev:workerd` and the Cloudflare deployment neither run nor bundle it — which is also why the
container carries its own `node_modules` instead of mounting the host's.

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

Everything under `src/temporal/__tests__/` runs against `@temporalio/testing`'s time-skipping test
server, which the SDK starts in-process, or against no server at all (`replay.test.ts`). None of them
need the Compose stack, so `npm run verify` keeps working for contributors who have never started
Temporal.

The suite that does need it is the parity run — `npm run --workspace=backend test:temporal`, the
whole backend suite a second time with the engine pinned to Temporal. It is deliberately outside
`verify.sh` for the same reason. `src/core/workflows/readme.md` explains what its number does and
does not prove.

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

