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

On a volume that has never been migrated, use `npm run --workspace=backend stack:reset` instead: the
`worker` service reads `proteus` at boot and exits if the tables are not there, and only that script
gets Postgres migrated before the Worker starts looking for it.

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

The UI is at <http://localhost:8088>; the gRPC frontend is at `localhost:7233`. Every execution and
its full history show up there — including the one a route just dispatched.
`npm run --workspace=backend temporal:ping` is a standalone round-trip probe left from the first
stage.

The Worker needs `@temporalio/core-bridge`, a native addon, so it is a **Node-only** process.
`npm run dev:workerd` and the Cloudflare deployment neither run nor bundle it — which is also why the
container carries its own `node_modules` instead of mounting the host's.

### Three services, not one

`temporalio/server` does nothing but serve. It does not create its databases, it does not migrate
their schemas, it does not register a namespace, and it will not start without a dynamic-config file
it does not ship. The deprecated `temporalio/auto-setup` image did all four on first boot; that is
the only thing it did, and it is why replacing it turns one compose service into three:

| Service | Image | What it does |
|---|---|---|
| `temporal-schema` | `temporalio/admin-tools` | Creates `temporal` and `temporal_visibility` and migrates both schemas, then exits. The server waits on it with `service_completed_successfully`. |
| `temporal` | `temporalio/server` | The frontend on `:7233`. Reads `temporal/dynamicconfig/development-sql.yaml`, mounted at `/etc/temporal/config/dynamicconfig`. |
| `temporal-create-namespace` | `temporalio/admin-tools` | Waits for `SERVING`, registers `default`, then exits. |

The shape and both shell scripts are the official ones from
[temporalio/samples-server](https://github.com/temporalio/samples-server/tree/main/compose), vendored
into `scripts/temporal/compose/` — re-sync by overwriting them, and read the header of
`create-namespace.sh` first, which carries a one-character fix to an upstream bug.

**`temporal-create-namespace` is what the rest of the stack waits on, not `temporal`.** The server
image is one binary plus busybox, with no `temporal` CLI in it, so its own healthcheck can only ask
whether the port is open. The namespace service polls `operator cluster health` before it does
anything and creates the namespace every client here connects to, so "that service exited 0" is the
stronger and more useful signal — `worker` and `temporal-ui` both depend on it.

### It shares the Postgres you already have

Temporal points at the existing `postgres` service rather than bringing its own, so its two databases
sit alongside `proteus`. One server, one volume, three databases. (The upstream sample runs a second
Postgres with its own `temporal`/`temporal` user; that part is deliberately not copied.)

The one thing worth knowing: **`npm run db:reset` is safe.** It drops and recreates `proteus` only,
so workflow history survives. `npm run stack:reset` is the command that destroys it — `down -v`, then
Postgres, migrate, seed, and the rest of the stack, with `temporal-schema` rebuilding Temporal's two
databases from empty. That teardown-and-rebuild is the supported way to move Temporal versions here;
nothing is deployed, so there is no history worth migrating forward.

### Configuration

`TEMPORAL_ADDRESS` (default `localhost:7233`) and `TEMPORAL_NAMESPACE` (default `default`) are
connection settings, and nothing more. Which engine executes a workflow is not an env var.

### Tests

Three runs, and only one of them is `npm test`.

| Command | What it runs | What it needs |
|---|---|---|
| `npm test` | the whole suite, engine pinned to `simple` | Postgres |
| `npm run test:temporal:server` | `src/**/*.server.test.ts` — the adapter against a real server | a downloaded test-server binary |
| `npm run test:temporal` | the `npm test` files again, engine pinned to `temporal` | Postgres + the Compose stack |

`*.server.test.ts` is a **separate run on purpose**. Those three files each boot
`@temporalio/testing`'s time-skipping server, which downloads a binary on first use and
webpack-bundles the workflow sandbox — minutes, and a network dependency on a cold cache. They cover
the seam between this adapter and the SDK, which moves when the SDK version does and not otherwise,
so paying that on every `npm test` buys very little. Name a new one `*.server.test.ts` and it lands
in that run automatically; `vitest.config.ts` excludes the glob so it cannot drift back.

The replay mechanism and the payload converter keep the plain `.test.ts` suffix and stay in
`npm test`: they cover the same code with no server at all, which is where the edge cases belong.

Neither the default run nor `verify.sh` needs the Compose stack. The parity run does, which is why
it is deliberately outside `verify.sh` — `src/core/workflows/readme.md` explains what its number does
and does not prove.

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

