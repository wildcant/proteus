# Backend

Standalone API server built with Ports & Adapters architecture, Drizzle ORM, and Awilix DI. See the root [CLAUDE.md](../../CLAUDE.md) for full architecture overview.

## Temporal (local stack)

**On Node, Temporal is the engine that runs your workflows.** `RUNTIME` defaults to `node`, and
`src/framework/workflows/engine-selection.ts` resolves `node` to the Temporal adapter — so under
`pnpm run dev` every `createWorkflow(...).run()` becomes an execution on the `proteus` task queue and
is executed step by step by a Worker. The in-process simple adapter
(`src/framework/workflows/simple-adapter.ts`) is what `pnpm run dev:workerd` and the Cloudflare deployment
get, because workerd cannot load Temporal's native Worker. Which engine runs is never an env var —
see `src/framework/workflows/README.md`.

### Starting it

```bash
docker compose -f apps/backend/docker-compose.yml up -d --wait   # postgres, temporal, temporal-ui, worker, events-worker, cron-worker
pnpm --filter backend run dev
```

On a volume that has never been migrated, use `pnpm --filter backend run stack:reset` instead: the
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
`pnpm run setup` (which fetches `.env.keys`) must have run first — the same precondition `pnpm run dev`
already has. Compose overrides only the two addresses that differ inside the network: Postgres and
Temporal are reached by service name rather than on `localhost`.

**Iterating on Worker code itself is what `pnpm --filter backend run worker` is for.** It runs the
same entrypoint through the same script, on the host, with no container in the loop:

```bash
docker compose -f apps/backend/docker-compose.yml stop worker   # don't let two Workers share the queue
pnpm --filter backend run worker
```

### Three Workers, three queues

| Service | Queue | Runs | Host command |
|---|---|---|---|
| `worker` | `proteus` | `src/workflows/` — a workflow's steps | `pnpm --filter backend run worker` |
| `events-worker` | `proteus-events` | `src/subscribers/` — one standalone activity per delivery | `pnpm --filter backend run worker:events` |
| `cron-worker` | `proteus-cron` | `src/jobs/` — one driver workflow per scheduled run | `pnpm --filter backend run worker:cron` |

`events-worker` is the event bus's side of Temporal: every `bus.emit(...)` on node becomes a
standalone activity execution on `proteus-events`, and this is the process that runs the subscriber.

`cron-worker` is the scheduler's. The API reconciles one Temporal Schedule per job in `src/jobs/` at
boot and starts no Worker — `scheduler.start(jobs)` writes schedules and executes nothing — so every
scheduled run is a driver workflow on `proteus-cron`, and this is the process that answers it. Run
one of these on the host and `docker compose ... stop <service>` first, for the same reason `worker`
needs it: both poll the same queue, and whichever is free claims the task.

**The queues are split by lifecycle, and the split is what keeps a tick and a checkout out of each
other's way.** A nightly job that runs for an hour must not hold a slot a shopper's
`authorize-payment` step is waiting for, and a checkout burst must not delay a scheduled run past
its next tick — under overlap `SKIP` a late run is a *dropped* run, not a queued one. One pool of
slots per kind of work is the only arrangement where neither can starve the other.

Urgency *within* a queue is a different question with a different answer: a priority key, not a
fourth queue. See ADR-0029.

The processes are split so those slot pools are genuinely separate, and so each can pin the workflow
engine it wants — the workflow Worker keeps nested `.run()` calls in-process, while the events and
cron Workers give a subscriber's or a job's `.run()` a durable execution of its own, which is what
makes "a nightly cleanup and an admin button share one implementation" true rather than aspirational.
See `src/framework/event-bus/README.md`.

`cron-worker` is the one non-workflow Worker with a healthcheck, and the reason is structural: a
Schedule's action can only start a *workflow*, so unlike `events-worker` this process registers one
and pays the same webpack pass over the sandbox entrypoint that `worker` does.
`temporal:worker-ready cron` is what `--wait` blocks on, so the cron queue has a poller by the time
the command returns rather than a minute later.

Standalone activities need `activity.enableStandalone` in Temporal's dynamic config; this repo's
`temporal/dynamicconfig/development-sql.yaml` sets it. Without it the server answers
`Standalone activity is disabled` at the first emit.

The UI is at <http://localhost:8088>; the gRPC frontend is at `localhost:7233`. Every execution and
its full history show up there — including the one a route just dispatched.
`pnpm --filter backend run temporal:ping` is a standalone round-trip probe left from the first
stage.

The Worker needs `@temporalio/core-bridge`, a native addon, so it is a **Node-only** process.
`pnpm run dev:workerd` and the Cloudflare deployment neither run nor bundle it — which is also why the
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
stronger and more useful signal — all three Workers and `temporal-ui` depend on it.

### It shares the Postgres you already have

Temporal points at the existing `postgres` service rather than bringing its own, so its two databases
sit alongside `proteus`. One server, one volume, three databases. (The upstream sample runs a second
Postgres with its own `temporal`/`temporal` user; that part is deliberately not copied.)

The one thing worth knowing: **`pnpm run db:reset` is safe.** It drops and recreates `proteus` only,
so workflow history survives. `pnpm run stack:reset` is the command that destroys it — `down -v`, then
Postgres, migrate, seed, and the rest of the stack, with `temporal-schema` rebuilding Temporal's two
databases from empty. That teardown-and-rebuild is the supported way to move Temporal versions here;
nothing is deployed, so there is no history worth migrating forward.

### Configuration

`TEMPORAL_ADDRESS` (default `localhost:7233`) and `TEMPORAL_NAMESPACE` (default `default`) are
connection settings, and nothing more. Which engine executes a workflow is not an env var.

### Tests

Three runs, and only one of them is `pnpm test`.

| Command | What it runs | What it needs |
|---|---|---|
| `pnpm test` | the whole suite, engine pinned to `simple` | Postgres |
| `pnpm run test:temporal:server` | `src/**/*.server.test.ts` — the adapter against a real server | a downloaded test-server binary |
| `pnpm run test:temporal` | the `pnpm test` files again, engine pinned to `temporal` | Postgres + the Compose stack |

`*.server.test.ts` is a **separate run on purpose**. Those three files each boot
`@temporalio/testing`'s time-skipping server, which downloads a binary on first use and
webpack-bundles the workflow sandbox — minutes, and a network dependency on a cold cache. They cover
the seam between this adapter and the SDK, which moves when the SDK version does and not otherwise,
so paying that on every `pnpm test` buys very little. Name a new one `*.server.test.ts` and it lands
in that run automatically; `vitest.config.ts` excludes the glob so it cannot drift back.

The replay mechanism and the payload converter keep the plain `.test.ts` suffix and stay in
`pnpm test`: they cover the same code with no server at all, which is where the edge cases belong.

Neither the default run nor `verify.sh` needs the Compose stack. The parity run does, which is why
it is deliberately outside `verify.sh` — `src/framework/workflows/README.md` explains what its number does
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

